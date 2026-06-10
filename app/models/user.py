"""
Database models for user management and profiles in the AkuMart platform.
"""

import uuid
from sqlalchemy import String, Boolean, Numeric, Text, ARRAY, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enum import UserRole


class User(Base, TimestampMixin):
    """
    Core user account model for the AkuMart platform.
    """

    __tablename__ = 'users'
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role: Mapped[UserRole] = mapped_column(String(20), nullable=False)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    business_name: Mapped[str | None] = mapped_column(String(200))
    business_type: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    seller_profile: Mapped["SellerProfile"] = relationship(
        back_populates='user', uselist=False, lazy='select'
    )
    buyer_profile: Mapped["BuyerProfile"] = relationship(
        back_populates='user', uselist=False, lazy='select'
    )


class SellerProfile(Base):
    """
    Extension profile for users acting as marketplace sellers.
    """

    __tablename__ = 'seller_profiles'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(          # ← ADD THIS
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        unique=True,
        nullable=False,
    )
    bio: Mapped[str | None] = mapped_column(Text)
    production_description: Mapped[str | None] = mapped_column(Text)
    avg_response_hrs: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    completion_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    total_kg_sold: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_orders: Mapped[int] = mapped_column(default=0)
    rating_avg: Mapped[float] = mapped_column(Numeric(3, 2), default=0)
    rating_count: Mapped[int] = mapped_column(default=0)
    bank_name: Mapped[str | None] = mapped_column(String(100))
    bank_account_no: Mapped[str | None] = mapped_column(String(20))
    account_name: Mapped[str | None] = mapped_column(String(100))

    user: Mapped['User'] = relationship(back_populates='seller_profile')


class BuyerProfile(Base):
    """
    Extension profile for users purchasing resources on the marketplace.
    """

    __tablename__ = 'buyer_profiles'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(          # ← ADD THIS
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        unique=True,
        nullable=False,
    )
    preferred_categories: Mapped[list | None] = mapped_column(ARRAY(String))
    preferred_location: Mapped[str | None] = mapped_column(String(100))
    ai_pref_vector: Mapped[dict | None] = mapped_column(JSON)
    last_search_at: Mapped[str | None] = mapped_column(String)

    user: Mapped['User'] = relationship(back_populates='buyer_profile')
