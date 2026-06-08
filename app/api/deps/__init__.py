"""
app/api/deps/__init__.py
FastAPI dependency injection layer.

Provides:
  - get_db             -> AsyncSession for each request
  - get_current_user   -> authenticated User ORM instance
  - require_buyer      -> role guard: buyers only
  - require_seller     -> role guard: sellers only
  - require_admin      -> role guard: admins only
"""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import async_session_local
from app.core.security import decode_token
from app.models.enum import UserRole
from app.models.user import User


# OAuth2 / Bearer scheme

_bearer = HTTPBearer(auto_error=False)


# Database session

async def get_db() -> AsyncSession:  # type: ignore[return]
    """
    Yield a single AsyncSession per request, then close it.
    Use as: `db: AsyncSession = Depends(get_db)`
    """
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
    except JWTError as exc:
        raise _unauthorized from exc

    if payload.type != "access":
        # Prevent refresh tokens from being used as access tokens.
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


# Convenience type aliases

CurrentUser = Annotated[User, Depends(get_current_user)]


# Role guards


def _require_role(role: UserRole):
    """
    Internal factory — returns a dependency that asserts the current
    user has the expected role, raising HTTP 403 otherwise.
    """

    async def _guard(user: CurrentUser) -> User:
        if user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to {role.value}s.",
            )
        return user

    return _guard


async def require_buyer(
    user: Annotated[User, Depends(_require_role(UserRole.BUYER))]
) -> User:
    """Dependency — resolves only for authenticated buyers."""
    return user


async def require_seller(
    user: Annotated[User, Depends(_require_role(UserRole.SELLER))]
) -> User:
    """Dependency — resolves only for authenticated sellers."""
    return user


async def require_admin(
    user: Annotated[User, Depends(_require_role(UserRole.ADMIN))]
) -> User:
    """Dependency — resolves only for authenticated admins."""
    return user


# Annotated shorthand aliases (use these in route signatures)

BuyerUser = Annotated[User, Depends(require_buyer)]
SellerUser = Annotated[User, Depends(require_seller)]
AdminUser = Annotated[User, Depends(require_admin)]
