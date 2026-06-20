"""
Profile completion and role-switching business logic.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.enum import ProfileStatus
from app.models.user import (
    SellerProfile,
    BuyerProfile,
    User
)
from app.schemas.user import SellerProfileUpdate, BuyerProfileUpdate


def compute_seller_profile_status(
    profile: SellerProfile,
    user: User,
) -> ProfileStatus:
    """
    Determine the seller profile's status after an edit.

    Rules
    -----
    - Missing required fields -> always INCOMPLETE, regardless of prior status.
    - Required fields present:
        - prior status INCOMPLETE  -> PENDING_VERIFICATION (
            freshly submitted, awaiting review
        )
        - prior status PENDING_VERIFICATION -> stays PENDING_VERIFICATION
        - prior status ACTIVE      -> PENDING_VERIFICATION (
            edited reviewed data, re-review required
        )
        - prior status INACTIVE    -> stays INACTIVE (
            admin/role-switch suspension is not
            undone by the seller simply editing their profile
        )

    ACTIVE is never set here — only an admin verification action sets ACTIVE.
    """
    required_present = (
        bool(profile.waste_categories)
        and bool(profile.bank_name)
        and bool(profile.bank_account_no)
        and bool(profile.account_name)
        and bool(user.business_name)
    )

    if not required_present:
        return ProfileStatus.INCOMPLETE

    if profile.profile_status == ProfileStatus.INACTIVE:
        return ProfileStatus.INACTIVE

    if profile.profile_status == ProfileStatus.ACTIVE:
        return ProfileStatus.PENDING_VERIFICATION

    return ProfileStatus.PENDING_VERIFICATION


def compute_buyer_profile_status(profile: BuyerProfile) -> ProfileStatus:
    """
    A buyer profile is ACTIVE once preferred_categories and preferred_location
    are both set.
    """
    required_present = bool(profile.preferred_categories) and bool(profile.preferred_location)
    return ProfileStatus.ACTIVE if required_present else ProfileStatus.INCOMPLETE


async def update_seller_profile(
    payload: SellerProfileUpdate,
    current_user: User,
    db: AsyncSession,
) -> SellerProfile:
    """
    Apply a partial update to the current user's seller profile,
    creating the row if it does not exist yet, then recompute status.

    Steps
    -----
    1. Guard — active_role must be 'seller'.
    2. Load existing profile, or build a fresh INCOMPLETE row.
    3. Apply only the fields present in the payload.
    4. Recompute profile_status — never accept it from the client.
    5. Commit and return.

    Raises
    ------
    HTTP 403 — active_role is not 'seller'.
    """
    if current_user.active_role is None:
        detail = "Select a role before completing a profile."
    elif current_user.active_role != "seller":
        detail = "Switch to the seller role before editing a seller profile."
    else:
        detail = None

    if detail:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    profile = current_user.seller_profile
    if profile is None:
        profile = SellerProfile(user_id=current_user.id)
        db.add(profile)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.profile_status = compute_seller_profile_status(
        profile, current_user
    )

    await db.commit()
    await db.refresh(profile)
    return profile


async def update_buyer_profile(
    payload: BuyerProfileUpdate,
    current_user: User,
    db: AsyncSession,
) -> BuyerProfile:
    """
    Apply a partial update to the current user's buyer profile,
    creating the row if it does not exist yet, then recompute status.

    Raises
    ------
    HTTP 403 — active_role is not 'buyer'.
    """
    if current_user.active_role is None:
        detail = "Select a role before completing a profile."
    elif current_user.active_role != "buyer":
        detail = "Switch to the buyer role before editing buyer profile."
    else:
        detail = None

    if detail:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    profile = current_user.buyer_profile
    if profile is None:
        profile = BuyerProfile(user_id=current_user.id)
        db.add(profile)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.profile_status = compute_buyer_profile_status(profile)

    await db.commit()
    await db.refresh(profile)
    return profile
