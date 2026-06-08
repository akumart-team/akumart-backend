"""
Shared Pydantic config and base schema for all AkuMart schemas.
"""

from pydantic import BaseModel, ConfigDict


class AkumartSchema(BaseModel):
    """
    Base schema with shared configuration for all Akumart schemas.
    - orm_mode enabled for SQLAlchemy model compatability
    - populate_by_name allows both alias and field name usage
    """

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )
