# Staff access through the API

Staff roles belong to the backend `StaffMembership` table. Marketplace preferences do not grant staff permissions. Every membership has one role: `super`, `operations`, `support`, `finance`, or `content`.

## First administrator

1. Register an account and verify its email using the normal auth endpoints.
2. Set `STAFF_BOOTSTRAP_PROFILE_ID` in the server environment to that account's UUID, then restart the backend. Keep this unset during normal operation. A UUID is an allowlist, not a substitute for authentication.
3. Sign in as that verified account and authorize Swagger with its access token.
4. Execute `POST /api/v1/admin/staff/bootstrap` without a body. The endpoint creates an active `super` membership and records an audit event.
5. Remove `STAFF_BOOTSTRAP_PROFILE_ID` from the server environment after success. Bootstrap also refuses to run if any current or historical super membership exists, including an inactive one. Disabling all super accounts directly in the database does not reopen bootstrap.

The bootstrap endpoint returns 401 without authentication, 404 when not configured, 403 for a different or unverified identity, and 409 when a super membership already exists. It does not accept an account ID or requested role from the request body.

## Manage staff

An active `super` account can call:

- `GET /api/v1/admin/staff?page=1&limit=20&search=email`: list staff memberships, including inactive ones. Search matches email.
- `PUT /api/v1/admin/staff/{profileId}`: assign, replace, reactivate or deactivate the membership of an existing account.

Example assignment:

```json
{
  "role": "operations",
  "active": true,
  "reason": "Responsible for AkuBin devices and collections"
}
```

Set `active` to `false` to remove staff access while retaining audit/history records. Both `role` and `active` must be provided, along with a reason of 5–1000 characters. For a new user, find their profile UUID with the existing `GET /api/v1/admin/users?search=email` endpoint.

Every change records the actor, target, previous state, new state and reason. Authorization is rechecked inside the transaction so an in-flight request cannot grant roles after its actor has been revoked. Staff writes are serialized, and serializable transaction retries protect against concurrent changes removing the last active super. An active super cannot demote or deactivate the last active super membership; first grant another trusted account `super` access. Existing bearer tokens lose staff access on the next guarded request after deactivation.

AkuBin device/bin operations accept `operations` or `super`. Reward configuration and redemption administration accept `finance` or `super`. A `super` test account covers both groups. Neither ordinary accounts nor any other staff role can assign staff roles.

## Verification

Run `npm run test:staff` for HTTP, auth guard, validation, audit, bootstrap and concurrent last-super tests against disposable PostgreSQL. This does not connect to the configured dev database or send email.
