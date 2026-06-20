"""Pydantic request/response schemas for authentication flows."""

import uuid
from typing import Literal
from pydantic import EmailStr, Field, field_validator

from app.models.enum import UserRole
from app.schemas.base import AkumartSchema
from app.schemas.user import UserOut


# Registration

class RegisterRequest(AkumartSchema):
    """Body schema for ``POST /auth/register``.

    Payload for new account creation.
    Accepted for both buyer and seller roles — admin accounts are
    created exclusively through the admin panel.
    """

    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    business_name: str | None = Field(None, max_length=200)
    business_type: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    address: str | None = None

    @field_validator("role")
    @classmethod
    def restrict_role(cls, value: UserRole) -> UserRole:
        """Prevent self-registration as admin."""
        if value == UserRole.ADMIN:
            raise ValueError("Cannot self-register with role 'admin'.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        """Enforce minimal password policy:

        - At least one digit
        - At least one uppercase letter
        """
        if not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isupper() for c in value):
            raise ValueError(
                "Password must contain at least one uppercase letter."
            )
        return value

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        """Strip surrounding whitespace from name fields."""
        return v.strip()

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        """Lowercase the e-mail so lookups are case-insensitive."""
        return v.strip().lower()

    @field_validator("phone", mode="before")
    @classmethod
    def strip_phone(cls, v: str) -> str:
        """Remove stray spaces from phone numbers."""
        return v.strip()


class RegisterResponse(AkumartSchema):
    """Returned after successful registration.

    Tokens are issued immediately so the client can proceed without
    a separate login step.
    """

    message: str = "Registration successful. Check your email for a verification code."
    user_id: uuid.UUID


# Login

class LoginRequest(AkumartSchema):
    """Standard email + password credential payload."""

    email: EmailStr
    password: str = Field(..., min_length=1)

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        """Lowercase the e-mail to match stored value."""
        return v.strip().lower()


class LoginResponse(AkumartSchema):
    """Returned after successful credential verification."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class LogoutRequest(AkumartSchema):
    """Body schema for ``POST /auth/logout``.

    The refresh token is accepted so the server can invalidate it.
    """

    refresh_token: str = Field(..., min_length=1)


# Token refresh

class TokenRefreshRequest(AkumartSchema):
    """Payload carrying the long-lived refresh token."""

    refresh_token: str = Field(..., min_length=1)


class TokenRefreshResponse(AkumartSchema):
    """Returned after a valid refresh — issues a new access token.

    The refresh token itself is rotated on each use.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# General message response for authentication requests
class MessageResponse(AkumartSchema):
    """Generic single-field response for operations that have no domain payload."""

    message: str


# Internal token payload (not an API schema — used by JWT helpers)
class TokenPayload(AkumartSchema):
    """Claims embedded in both access and refresh JWTs.

    `sub` holds the user UUID as a string.
    `type` distinguishes access from refresh tokens.
    """

    sub: str
    role: str
    active_role: str | None
    registered_roles: list[str]
    type: Literal["access", "refresh"]
    iat: int
    exp: int


# Verification Schemas

class VerifyOTPRequest(AkumartSchema):
    """Body schema for verifying a user's email via an OTP code."""

    user_id: uuid.UUID
    otp: str = Field(..., min_length=6, max_length=6)


class VerifyOTPResponse(AkumartSchema):
    """Returned after successful OTP verification, providing valid session tokens."""

    message: str = "Email verified."
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class ResendOTPRequest(AkumartSchema):
    """Body schema for ``POST /auth/resend-otp/``."""

    user_id: uuid.UUID

class SelectRoleRequest(AkumartSchema):
    """
    Body schema for ``POST /auth/select-role``.
    """

    role: UserRole


class SelectRoleResponse(AkumartSchema):
    """Returned after successful role selection."""

    message: str = "Role selected successfully."
    active_role: UserRole
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
