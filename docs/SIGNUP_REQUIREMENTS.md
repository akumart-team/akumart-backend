# Account creation and roles

`POST /api/v1/auth/register` requires all of these values:

| Field | Rule |
|---|---|
| firstName / lastName | Trimmed, non-empty, at most 50 characters each. |
| email | Valid address, trimmed/lowercased, at most 254 characters. |
| phone | 10–15 digits, optional leading `+`; contact information, not verified phone ownership. |
| city | Trimmed, 2–100 characters. |
| marketRole | `buyer`, `seller`, `both` or `logistics`; no default selection or `none`. |
| akubin | Explicit boolean; independent of role. Both true and false are valid. |
| password | 8–72 characters, not only spaces. Frontend confirmation is not sent to this endpoint. |
| acceptedTerms | Must be true. Privacy acknowledgment is not a separately invented consent record. |

Signup stores role/contact details in Supabase user metadata; the profile creation
trigger writes the role and contact fields to application tables. The independent
AkuBin flag is copied to preferences before successful email verification returns
the authenticated session. Subsequent login does not overwrite user preferences.
No staff membership or partner approval is created from signup metadata.

AkuBin is available to all four roles. Enabling it expresses a service preference;
it is not a separate role or a permission to administer bins. Marketplace verification
never gates recycling. Logistics applicants still submit business/vehicle documents
and await staff approval before working delivery jobs.

The previously applied migrations `20261115180000_account_roles` and
`20261115180100_signup_preferences` support logistics role persistence. Their historical
`recycler` enum value and `none` are retained to read old records; current signup and
preference validation reject them as choices. Do not rewrite applied migrations or
silently classify old members as buyers. Old incomplete accounts choose a role in
onboarding; finishing requires names, valid phone, city and accepted terms. Explicit
terms acceptance during onboarding uses the existing consent-record trigger.

`GET /api/v1/orders` and `GET /api/v1/users/me/offers` accept optional
`mode=buyer|seller`. Ownership filtering happens before pagination, including count.
Omitting mode preserves the old combined own-history response. This does not grant
access to another member's records or turn role preferences into staff permissions.

Tests: `node --test test/signup-validation.test.cjs test/schema-integrity.test.cjs`.
Platform integration tests also cover onboarding rollback, explicit consent,
independent AkuBin preferences under every role and role-scoped pagination.
