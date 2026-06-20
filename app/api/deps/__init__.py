"""
app/api/deps/__init__.py
FastAPI dependency injection layer.

Provides:
  - get_db                -> AsyncSession for each request
  - get_current_user      -> authenticated User ORM instance
  - require_buyer         -> role guard: active_role == buyer
  - require_seller        -> role guard: active_role == seller
  - require_admin         -> role guard: active_role == admin
  - require_active_profile -> marketplace guard
"""

import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import async_session_local
from app.core.security import decode_token
from app.models.enum import ProfileStatus, UserRole
from app.models.user import User


# OAuth2 / Bearer scheme

_bearer = HTTPBearer(auto_error=False)


# Database session

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a single AsyncSession per request, then close it."""
    async with async_session_local() as session:
        yield session


# Current-user resolution

async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Decode the Bearer JWT, look up the user in the database, and return
    the ORM instance with both sub-profiles eagerly loaded.

    Does NOT enforce active_role — that is handled by role guards.
    Raises HTTP 401 on any authentication failure.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise _unauthorized

    try:
        payload = decode_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise _unauthorized from exc

    if payload.type != "access":
        raise _unauthorized

    try:
        user_id = uuid.UUID(payload.sub)
    except ValueError as exc:
        raise _unauthorized from exc

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.seller_profile),
            selectinload(User.buyer_profile),
        )
    )
    user: User | None = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise _unauthorized

    return user


# Role guards

def _require_active_role(role: UserRole):
    """
    Factory — returns a dependency that asserts the user's active_role
    matches the expected role, raising HTTP 403 otherwise.
    """

    async def _guard(user: CurrentUser) -> User:
        if user.active_role != role.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to {role.value}s.",
            )
        return user

    return _guard


def _require_admin_role():
    """Separate factory for admin since it uses UserRole"""

    async def _guard(user: CurrentUser) -> User:
        if user.active_role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted to admins.",
            )
        return user

    return _guard


async def require_buyer(
    user: Annotated[User, Depends(_require_active_role(UserRole.BUYER))]
) -> User:
    """Dependency — resolves only when active_role == buyer."""
    return user


async def require_seller(
    user: Annotated[User, Depends(_require_active_role(UserRole.SELLER))]
) -> User:
    """Dependency — resolves only when active_role == seller."""
    return user


async def require_admin(
    user: Annotated[User, Depends(_require_admin_role())]
) -> User:
    """Dependency — resolves only when active_role == admin."""
    return user


# Marketplace access guard

async def require_active_profile(user: CurrentUser) -> User:
    """
    Dependency — resolves only when the user's active profile
    has been verified and set to active by an admin.

    Used on all marketplace endpoints (listings, offers, search).
    Raises HTTP 403 if profile is incomplete or pending verification.
    """
    if user.active_role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Select a role before accessing the marketplace.",
        )

    profile = (
        user.seller_profile
        if user.active_role == UserRole.SELLER.value
        else user.buyer_profile
    )

    if profile is None or profile.profile_status != ProfileStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete and verify your profile before accessing the marketplace.",
        )

    return user


# Annotated shorthand aliases
CurrentUser = Annotated[User, Depends(get_current_user)]
BuyerUser = Annotated[User, Depends(require_buyer)]
SellerUser = Annotated[User, Depends(require_seller)]
AdminUser = Annotated[User, Depends(require_admin)]
MarketplaceUser = Annotated[User, Depends(require_active_profile)]
