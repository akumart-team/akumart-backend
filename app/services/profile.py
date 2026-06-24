"""
Profile completion and role-switching business logic.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.security import (
    create_access_token,
    create_refresh_token
)

from app.models.enum import (
    ProfileStatus,
    ActiveRole,
)
from app.models.user import (
    SellerProfile,
    BuyerProfile,
    User
)
from app.schemas.user import SellerProfileUpdate, BuyerProfileUpdate
from app.schemas.auth import SwitchRoleRequest, SwitchRoleResponse


# Helpers
def _make_tokens(
    user_id: uuid.UUID,
    active_role: str | None,
    registered_roles: list[str],
) -> tuple[str, str]:
    """
    Return ``(access_token, refresh_token)`` for the given user.
    """

    uid = str(user_id)

    return (
        create_access_token(uid, active_role, registered_roles),
        create_refresh_token(uid, active_role, registered_roles),
    )


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
        detail = "Switch to the buyer role before editing your buyer profile."
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


async def switch_role(
    payload: SwitchRoleRequest,
    current_user: User,
    db: AsyncSession,
) -> SwitchRoleResponse:
    """
    Switch the current user's active_role to a different role.

    A switch only succeeds if a profile row already exists for the
    target role and that profile is not INACTIVE. If no profile exists
    yet, the switch is blocked and the client should redirect the user
    to PATCH /me/{role}_profile to create one — that endpoint's
    create-if-missing behavior is the only place profile rows get
    created. INCOMPLETE and PENDING_VERIFICATION profiles ARE allowed
    to switch in; per-route guards (require_active_profile) handle
    what they're permitted to DO once active, not switch_role.

    Steps
    -----
    1. Guard — target_role must differ from active_role.
    2. Load the target profile (already eager-loaded on current_user).
    3. Branch:
       a. Profile does not exist -> 403, no state change, message
          directs the client to profile setup.
       b. Profile is INACTIVE -> 403, contact-support message.
       c. Profile exists and is not INACTIVE (INCOMPLETE,
          PENDING_VERIFICATION, or ACTIVE) -> switch succeeds.
          registered_roles gains target_role if new.
    4. Commit, reissue tokens, return SwitchRoleResponse including
       the target profile's current status.

    Raises
    ------
    HTTP 400 — target_role equals current active_role.
    HTTP 403 — target profile does not exist, or is INACTIVE.
    """
    target_role = payload.target_role.value

    # 1. No-op guard
    if target_role == current_user.active_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already active in this role.",
        )

    # 2. Load target profile
    target_profile = (
        current_user.seller_profile
        if target_role == ActiveRole.SELLER.value
        else current_user.buyer_profile
    )

    # 3a. No profile yet -> block, redirect to profile setup
    if target_profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"No {target_role} profile found."
                f"Complete profile setup to switch."
            )
        )

    # 3b. Profile exists but INACTIVE -> the only other block
    if target_profile.profile_status == ProfileStatus.INACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your {target_role} profile is inactive. Contact support to reactivate it.",
        )

    # 3c. Profile exists and is not INACTIVE -> switch succeeds
    current_user.active_role = payload.target_role
    if target_role not in current_user.registered_roles:
        current_user.registered_roles = [*current_user.registered_roles, target_role]

    await db.commit()
    await db.refresh(current_user)

    access_token, refresh_token = _make_tokens(
        current_user.id,
        current_user.active_role,
        current_user.registered_roles,
    )

    return SwitchRoleResponse(
        message=f"Switched to {target_role}.",
        profile_exists=True,
        profile_status=target_profile.profile_status,
        active_role=current_user.active_role,
        access_token=access_token,
        refresh_token=refresh_token,
    )
