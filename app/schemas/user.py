"""
Pydantic request/reponse schemas for users and their sub-profiles.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, Field

from app.models.enum import UserRole
from app.schemas.base import AkumartSchema


# Sub-profile schemas

class SellerProfileOut(AkumartSchema):
    """
    Read-only view of a seller's extended profile data.
    """

    id: uuid.UUID
    bio: Optional[str] = None
    production_description: Optional[str] = None
    avg_response_hrs: float = 0.0
    completion_rate: float = 0.0
    total_kg_sold: float = 0.0
    total_orders: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    bank_name: Optional[str] = None
    # Sensitive fields are excluded from public-facing schema
    # bank_account_no and account_name are served only via /me or admin routes.


class SellerProfileUpdate(AkumartSchema):
    """
    Partial update payload for seller profile fields.
    All fields are optional — only supplied fields are applied.
    """

    bio: Optional[str] = Field(None, max_length=1000)
    production_description: Optional[str] = Field(None, max_length=2000)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_account_no: Optional[str] = Field(None, max_length=20)
    account_name: Optional[str] = Field(None, max_length=100)


class BuyerProfileOut(AkumartSchema):
    """
    Read-only view of a buyer's extended profile data.
    """

    id: uuid.UUID
    preferred_categories: Optional[list[str]] = None
    preferred_location: Optional[str] = None
    last_search_at: Optional[str] = None
    # ai_pref_vector is an internal embedding — excluded from API output.


class BuyerProfileUpdate(AkumartSchema):
    """
    Partial update payload for buyer profile fields.
    """

    preferred_categories: Optional[list[str]] = None
    preferred_location: Optional[str] = Field(None, max_length=100)


# Core user schemas

class UserBase(AkumartSchema):
    """
    Shared readable fields present on most user-related responses.
    """

    id: uuid.UUID
    role: UserRole
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    avatar_url: Optional[str] = None
    is_verified: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserOut(UserBase):
    """
    Full user object returned to authenticated callers of /me.
    Includes the relevant sub-profile based on the user's role.
    """

    seller_profile: Optional[SellerProfileOut] = None
    buyer_profile: Optional[BuyerProfileOut] = None


class UserPublic(AkumartSchema):
    """
    Minimal public-facing user view for listing pages and reviews.
    Strips all personally identifiable information.
    """

    id: uuid.UUID
    first_name: str
    last_name: str
    business_name: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    is_verified: bool


class UserUpdate(AkumartSchema):
    """
    Partial update payload for core user fields.
    Email and phone changes require a separate verification flow.
    """

    first_name: Optional[str] = Field(None, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    business_name: Optional[str] = Field(None, max_length=200)
    business_type: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
