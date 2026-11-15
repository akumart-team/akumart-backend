# Account creation and roles

`POST /api/v1/auth/register` requires all of these values:

| Field | Rule |
|---|---|
| firstName / lastName | Trimmed, non-empty, at most 50 characters each. |
| displayName | Trimmed, non-empty, at most 100 characters; shown in Settings. |
| email | Valid address, trimmed/lowercased, at most 254 characters. |
| phone | 10–15 digits, optional leading `+`; contact information, not verified phone ownership. |
| city | Trimmed, 2–100 characters. |
| marketRole | `buyer`, `seller`, `both`, `logistics` or `recycler`; no default selection or `none`. |
| akubin | Compatibility boolean; the frontend sends true and the backend always includes AkuBin. No visibility toggle remains. |
| password | 8–72 characters, not only spaces. Frontend confirmation is not sent to this endpoint. |
| acceptedTerms | Must be true. Privacy acknowledgment is not a separately invented consent record. |

Signup stores role/contact details in Supabase user metadata; the profile creation
trigger writes role/contact fields to application tables. Verified confirmation
also fills missing signup details from metadata and completes valid profiles. Login
and authenticated profile loading can recover missing legacy values; existing saved
values and configured account roles are preserved. Authentication always opens the account dashboard; no second setup page is required.
No staff membership or partner approval is created from signup metadata.

AkuBin is available to every role. The `recycler` signup choice means Recycle & Earn
as the main workspace; it does not grant permission to administer bins. AkuBin
appears in every workspace, including accounts with an old false preference. Marketplace verification
never gates recycling. Logistics applicants still submit business/vehicle documents
and await staff approval before working delivery jobs.

The previously applied migrations `20261115180000_account_roles` and
`20261115180100_signup_preferences` support logistics role persistence. The existing
`recycler` value is now accepted for signup/preferences; `none` remains legacy-only.
No new migration is needed for the recycling-first signup choice. Do not rewrite applied migrations or
silently classify old members as buyers. Old incomplete accounts choose a role in
Settings. Required names, display name, phone, city and terms are collected at
signup. Older accounts can also explicitly accept missing terms in Settings; the
existing consent-record trigger remains authoritative. The legacy onboarding API
is retained for compatibility but is not a required sign-in step.

`GET /api/v1/orders` and `GET /api/v1/users/me/offers` accept optional
`mode=buyer|seller`. Ownership filtering happens before pagination, including count.
Omitting mode preserves the old combined own-history response. This does not grant
access to another member's records or turn role preferences into staff permissions.

Tests: `node --test test/signup-validation.test.cjs test/schema-integrity.test.cjs`.
Platform integration tests also cover onboarding rollback, explicit consent,
independent AkuBin preferences under every role and role-scoped pagination.
