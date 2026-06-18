"""
Authentication business logic for the AkuMart platform.

All database I/O and token operations live here; routers stay thin.

Public surface:
  - register_user   -> (User, TokenResponse)
  - login_user      -> TokenResponse
  - refresh_tokens  -> TokenResponse
  - logout_user     -> None   (no-op in stateless mode; extend for deny-list)
"""

import uuid

from fastapi import HTTPException, status
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.otp import (
    generate_otp,
    store_otp,
    verify_otp as check_otp,
    check_resend_rate_limit
)
from app.core.email import send_verification_email
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    TokenRefreshRequest,
    RegisterRequest,
    RegisterResponse,
    LoginResponse,
    TokenRefreshResponse,
    VerifyOTPRequest,
    VerifyOTPResponse,
    MessageResponse,
    ResendOTPRequest
)
from app.schemas.user import UserOut


# Helpers
def _make_tokens(user_id: uuid.UUID, active_role: str | None) -> tuple[str, str]:
    uid = str(user_id)
    role_val = active_role or ""
    return (
        create_access_token(uid, role_val),
        create_refresh_token(uid, role_val),
    )


async def _fetch_user_with_profiles(
    db: AsyncSession, user_id: uuid.UUID
) -> User | None:
    """
    Load a User row together with both sub-profiles in one query.
    Returns ``None`` when the user does not exist.
    """
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.seller_profile),
            selectinload(User.buyer_profile),
        )
    )
    return result.scalar_one_or_none()


# Service functions

async def register_user(
    payload: RegisterRequest,
    db: AsyncSession,
) -> tuple[User, RegisterResponse]:
    """
    Create a new user account
    """
    dup_email = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if dup_email.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    dup_phone = await db.execute(
        select(User).where(User.phone == payload.phone)
    )
    if dup_phone.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists.",
        )

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        business_name=payload.business_name,
        business_type=payload.business_type,
        state=payload.state,
        city=payload.city,
        address=payload.address,
        active_role=None,
        registered_roles=[],
    )
    db.add(user)
    await db.flush()

    await db.commit()

    otp = generate_otp()
    await store_otp(str(user.id), otp)
    await send_verification_email(user.email, otp)

    return RegisterResponse(user_id=user.id)


async def verify_otp_and_activate(
    payload: VerifyOTPRequest,
    db: AsyncSession,
) -> VerifyOTPResponse:
    """
    Validate the OTP submitted by the user and activate their account.

    Steps
    -----
    1. Load the user row.
    2. Guard against already-verified accounts.
    3. Validate the OTP against Redis.
    4. Flip is_verified = True and commit.
    5. Issue tokens with active_role=None (role selection comes next).
    6. Return VerifyOTPResponse.

    Raises
    ------
    HTTP 404  — user not found.
    HTTP 409  — account already verified.
    HTTP 400  — invalid or expired OTP.
    """
    # 1. Load user
    user = await _fetch_user_with_profiles(db, payload.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # 2. Already verified guard
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account is already verified.",
        )

    # 3. Validate OTP
    is_valid = await check_otp(str(user.id), payload.otp)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    # 4. Activate account
    user.is_verified = True
    await db.commit()
    await db.refresh(user)

    # 5. Issue tokens — active_role is None until role selection
    access_token, refresh_token = _make_tokens(user.id, user.active_role)

    # 6. Return response
    return VerifyOTPResponse(
        user=UserOut.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


async def resend_otp(
    payload: ResendOTPRequest,
    db: AsyncSession,
) -> MessageResponse:
    """
    Generate and resend a fresh OTP to the user's email.

    Raises
    ------
    HTTP 404  — user not found.
    HTTP 409  — account already verified.
    HTTP 429  — resend limit exceeded (3 per hour).
    """
    result = await db.execute(select(User).where(User.id == payload.user_id))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account is already verified.",
        )

    allowed = await check_resend_rate_limit(str(user.id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many resend attempts. Please wait before trying again.",
        )

    otp = generate_otp()
    await store_otp(str(user.id), otp)
    await send_verification_email(user.email, otp)

    return MessageResponse(message="Verification code resent. Check your email.")


async def login_user(
    payload: LoginRequest,
    db: AsyncSession,
) -> LoginResponse:
    """
    Verify credentials and return a token pair + user object.

    Raises
    ------
    HTTP 401  — bad credentials (deliberately vague to prevent enumeration).
    HTTP 403  — account is deactivated.
    """
    _bad_creds = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    result = await db.execute(select(User).where(User.email == payload.email))
    user: User | None = result.scalar_one_or_none()

    if user is None or not verify_password(
        payload.password, user.password_hash
    ):
        raise _bad_creds

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    # Reload with sub-profiles so UserOut serialises correctly
    full_user = await _fetch_user_with_profiles(db, user.id)
    if full_user is None:
        raise _bad_creds

    access_token, refresh_token = _make_tokens(full_user.id, full_user.active_role)
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(full_user),
    )


async def refresh_tokens(
    payload: TokenRefreshRequest,
    db: AsyncSession,
) -> TokenRefreshResponse:
    """
    Validate a refresh token and rotate it into a new token pair.

    Raises
    ------
    HTTP 401  — token invalid, expired, or wrong type.
    HTTP 401  — associated user no longer active.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token_data = decode_token(payload.refresh_token)
    except InvalidTokenError as exc:
        raise _unauthorized from exc

    if token_data.type != "refresh":
        raise _unauthorized

    try:
        user_id = uuid.UUID(token_data.sub)
    except ValueError as exc:
        raise _unauthorized from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise _unauthorized

    # To-do: record token JTI in deny-list before issuing new pair.
    access_token, new_refresh_token = _make_tokens(user.id, user.role)
    return TokenRefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


async def logout_user(
    _payload: LogoutRequest,  # noqa: ARG001
) -> None:
    """
    Invalidate the supplied refresh token.
    Phase 3 — stateless stub: the server trusts the client to discard
    its stored tokens locally.
    Phase 4 hook:
        jti = decode_token(payload.refresh_token).jti
        await deny_list.add(jti, ttl=remaining_seconds)
    """
