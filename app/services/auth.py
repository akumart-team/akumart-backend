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
from app.models.enum import UserRole
from app.models.user import BuyerProfile, SellerProfile, User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    TokenRefreshRequest,
    RegisterRequest,
    RegisterResponse,
    LoginResponse,
    TokenRefreshResponse
)
from app.schemas.user import UserOut


# Helpers
def _make_tokens(user_id: uuid.UUID, role: UserRole) -> tuple[str, str]:
    """
    Return ``(access_token, refresh_token)`` for the given user.
    """
    uid = str(user_id)
    role_val = role.value
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
    Create a new user account and its role-specific sub-profile.

    Steps
    -----
    1. Guard against duplicate e-mail and phone.
    2. Hash the plaintext password.
    3. Persist the ``User`` row and flush to obtain its PK.
    4. Create the matching ``BuyerProfile`` or ``SellerProfile``.
    5. Reload the user with sub-profiles eagerly loaded.
    6. Build and return the ``RegisterResponse``.

    Raises
    ------
    HTTP 409  — e-mail or phone already registered.
    """
    # 1. Duplicate e-mail check
    dup_email = await db.execute(
        select(User).where(User.email == payload.email)
    )
    if dup_email.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # 1. Duplicate phone check
    dup_phone = await db.execute(
        select(User).where(User.phone == payload.phone)
    )
    if dup_phone.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists.",
        )

    # 2-3. Create and persist the User row
    user = User(
        role=payload.role,
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
    )
    db.add(user)
    await db.flush()  # populate user.id before the FK on the sub-profile

    # 4. Role-specific sub-profile
    if payload.role == UserRole.SELLER:
        db.add(SellerProfile(id=uuid.uuid4(), user=user))
    else:
        db.add(BuyerProfile(id=uuid.uuid4(), user=user))

    await db.commit()

    # 5. Reload with relationships populated
    refreshed = await _fetch_user_with_profiles(db, user.id)
    if refreshed is None:  # should never happen
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User created but could not be retrieved.",
        )

    # 6. Build response
    access_token, refresh_token = _make_tokens(refreshed.id, refreshed.role)
    response = RegisterResponse(
        user=UserOut.model_validate(refreshed),
        access_token=access_token,
        refresh_token=refresh_token,
    )
    return refreshed, response


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

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This account has been deactivated."
                "Please contact support."
            ),
        )

    # Reload with sub-profiles so UserOut serialises correctly
    full_user = await _fetch_user_with_profiles(db, user.id)
    if full_user is None:
        raise _bad_creds

    access_token, refresh_token = _make_tokens(full_user.id, full_user.role)
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
