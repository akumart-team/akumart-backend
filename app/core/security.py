"""
JWT token creation, decoding, and password hashing utilities.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt

from app.core.config import settings
from app.schemas.auth import TokenPayload


# Password helpers

def hash_password(plain: str) -> str:
    """
    Return a bcrypt hash of the supplied plaintext password.
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """
    Return True if `plain` matches the stored bcrypt hash.
    """
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# Token creation

def _make_token(
    subject: str,
    role: str,
    token_type: Literal["access", "refresh"],
    expires_delta: timedelta,
) -> str:
    """
    Internal factory — build and sign a JWT with the given claims.
    """
    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    payload: dict = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_access_token(user_id: str, role: str) -> str:
    """
    Issue a short-lived JWT access token.
    Lifetime is controlled by ACCESS_TOKEN_EXPIRE_MINUTES in settings.
    """
    return _make_token(
        subject=user_id,
        role=role,
        token_type="access",
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str, role: str) -> str:
    """
    Issue a long-lived JWT refresh token.
    Lifetime is controlled by REFRESH_TOKEN_EXPIRE_DAYS in settings.
    """
    return _make_token(
        subject=user_id,
        role=role,
        token_type="refresh",
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


# Token decoding

def decode_token(token: str) -> TokenPayload:
    """
    Decode and validate a JWT.  Raises `JWTError` on any failure
    (expired, tampered, wrong algorithm, etc.).

    The caller is responsible for catching `JWTError` and converting
    it to the appropriate HTTP response.
    """
    raw: dict = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    return TokenPayload(**raw)
