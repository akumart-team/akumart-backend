"""
Mixin utility providing automated tracking for database entry timestamps.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

def utcnow():
    """
    Return the current system time in the UTC timezone.
    """
    return datetime.now(timezone.utc)

class TimestampMixin:
    """
    Equivalent to Django's auto_now / auto_now_add fields.
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow
    )
