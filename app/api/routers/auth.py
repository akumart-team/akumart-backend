"""
Authentication enpoints for the AkuMart platform.

Routes
------
POST /auth/register   — create account, auto-login, return token pair
POST /auth/login      — verify credentials, return token pair
POST /auth/refresh    — exchange refresh token for a new pair
POST /auth/logout     — invalidate refresh token
GET  /auth/me         — return the authenticated user's own profile 
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    MessageResponse,
)

from app.schemas.user import UserOut
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

DBSession = Annotated[AsyncSession, Depends(get_db)]


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new buyer or seller account",
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
    - Creates the matching sub-profile (BuyerProfile or SellerProfile).
    - Returns user object + token pair so the client is immediately
      authenticated after registration.
    """
    _user, response = await auth_service.register_user(payload, db)
    return response


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
    consumed and must not be reused. Store the new pair returned.
    """
    return await auth_service.refresh_tokens(payload, db)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate the current refresh token",
)
async def logout(
    payload: LogoutRequest,
    _db: DBSession,  # noqa: ARG001  — reserved for Phase 4 deny-list writes
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
    Return the full profile of the authenticated user, including the
    role-specific sub-profile (seller or buyer) where available.
 
    Sub-profiles are loaded eagerly by the ``get_current_user`` dependency.
    """
    return UserOut.model_validate(current_user)
