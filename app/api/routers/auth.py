"""
Authentication endpoints for the AkuMart platform.

Routes
------
POST /auth/register     — create account, dispatch OTP
POST /auth/verify-otp   — verify email OTP, return token pair
POST /auth/resend-otp   — resend OTP to email
POST /auth/login        — verify credentials, return token pair
POST /auth/refresh      — exchange refresh token for a new pair
POST /auth/logout       — invalidate refresh token
GET  /auth/me           — return the authenticated user's own profile
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    ResendOTPRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    VerifyOTPRequest,
    VerifyOTPResponse,
    SelectRoleRequest,
    SelectRoleResponse
)
from app.schemas.user import UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

DBSession = Annotated[AsyncSession, Depends(get_db)]


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account",
)
async def register(
    payload: RegisterRequest,
    db: DBSession,
) -> RegisterResponse:
    """
    Create a new user account.

    - Validates uniqueness of e-mail and phone.
    - Enforces password strength policy (digit + uppercase).
    - Hashes password with bcrypt before persistence.
    - Dispatches a 6-digit OTP to the provided email.
    - No tokens issued yet — client must verify email first.
    """
    return await auth_service.register_user(payload, db)


@router.post(
    "/verify-otp",
    response_model=VerifyOTPResponse,
    summary="Verify email with OTP code",
)
async def verify_otp(
    payload: VerifyOTPRequest,
    db: DBSession,
) -> VerifyOTPResponse:
    """
    Validate the OTP sent to the user's email.

    - Activates the account on success.
    - Returns a token pair with active_role=None.
    - Client must proceed to /auth/select-role next.
    """
    return await auth_service.verify_otp_and_activate(payload, db)


@router.post(
    "/resend-otp",
    response_model=MessageResponse,
    summary="Resend OTP verification code",
)
async def resend_otp(
    payload: ResendOTPRequest,
    db: DBSession,
) -> MessageResponse:
    """
    Generate and resend a fresh OTP to the user's email.

    Rate limited to 3 resends per hour per user.
    """
    return await auth_service.resend_otp(payload, db)


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate with email and password",
)
async def login(
    payload: LoginRequest,
    db: DBSession,
) -> LoginResponse:
    """
    Verify credentials and issue a JWT access + refresh token pair.

    Returns HTTP 401 for both bad e-mail and bad password to prevent
    user-enumeration attacks.
    """
    return await auth_service.login_user(payload, db)


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    summary="Rotate tokens using a valid refresh token",
)
async def refresh(
    payload: TokenRefreshRequest,
    db: DBSession,
) -> TokenRefreshResponse:
    """
    Exchange a refresh token for a new access + refresh token pair.

    Uses a rotating refresh-token strategy — the submitted token is
    consumed and must not be reused.
    """
    return await auth_service.refresh_tokens(payload, db)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate the current refresh token",
)
async def logout(
    payload: LogoutRequest,
    _db: DBSession,
) -> MessageResponse:
    """
    Revoke the supplied refresh token.

    Phase 3 — stateless stub. The client must discard stored tokens.
    A server-side deny-list will be wired in Phase 4.
    """
    await auth_service.logout_user(payload)
    return MessageResponse(message="Logged out successfully.")


@router.get(
    "/me",
    response_model=UserOut,
    summary="Return the currently authenticated user's profile",
)
async def me(
    current_user: CurrentUser,
) -> UserOut:
    """
    Return the full profile of the authenticated user, including
    sub-profiles where available.
    """
    return UserOut.model_validate(current_user)

@router.post(
    "/select-role",
    response_model=SelectRoleResponse,
    summary="Select buyer or seller role after email verification",
)
async def select_role(
    payload: SelectRoleRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> SelectRoleResponse:
    """
    Assign active_role to a verified account.

    - Only callable once — role is None at this point.
    - Reissues JWT with active_role embedded.
    - Client proceeds to profile setup after this.
    """
    return await auth_service.select_role(payload, current_user, db)
