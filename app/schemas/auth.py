""".
Pydantic request/response schemas for authentication flows.
"""

from pydantic import EmailStr, Field, field_validator

from app.models.enum import UserRole
from app.schemas.base import AkumartSchema
from app.schemas.user import UserOut


# Registration

class RegisterRequest(AkumartSchema):
    """
    Payload for new account creation.
    Accepted for both buyer and seller roles — admin accounts are
    created exclusively through the admin panel.
    """

    role: UserRole = Field(..., description="Must be 'buyer' or 'seller'.")
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
        """
        Enforce minimal password policy:
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


class RegisterResponse(AkumartSchema):
    """
    Returned after successful registration.
    Tokens are issued immediately so the client can proceed without
    a separate login step.
    """

    message: str = "Registration successful."
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Login

class LoginRequest(AkumartSchema):
    """
    Standard email + password credential payload.
    """

    email: EmailStr
    password: str = Field(..., min_length=1)


class LoginResponse(AkumartSchema):
    """
    Returned after successful credential verification.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


# Token refresh

class TokenRefreshRequest(AkumartSchema):
    """
    Payload carrying the long-lived refresh token.
    """

    refresh_token: str


class TokenRefreshResponse(AkumartSchema):
    """
    Returned after a valid refresh — issues a new access token.
    The refresh token itself is rotated on each use.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Internal token payload (not an API schema — used by JWT helpers)
class TokenPayload(AkumartSchema):
    """
    Claims embedded in both access and refresh JWTs.
    `sub` holds the user UUID as a string.
    `type` distinguishes access from refresh tokens.
    """

    sub: str
    role: str
    type: str  # "access" | "refresh"
    exp: int
