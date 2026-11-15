# AkuBin API v1

This module implements the current master ESP32 payloads without changing firmware.
Controllers handle HTTP/validation; services separate PINs, hardware, reads, rewards and operations.
All paths below are relative to `/api/v1`. Swagger exposes request schemas at `/docs` in development.
Responses use `{ data: ... }`; paginated responses also include `{ pagination: { page, limit, total } }`.
Decimal quantities/points are JSON strings. Points wallet balances are **points**, not money.

## Hardware contracts

### POST /akubin/sessions/phone-pin

```json
{ "binId": "AKUBIN-001", "identifier": "001234" }
```

`identifier` is a permanent, unique 6–12 digit PIN, with leading zeros preserved. It is not
a phone number despite the firmware route name. The service checks the registered controller,
availability, configured material rates, PIN lookup/verification and current sessions.

```json
{
  "data": {
    "sessionId": "generated-uuid",
    "expiresAt": "ISO timestamp",
    "resumed": false
  }
}
```

Returns 200, matching firmware expectations. Wrong/unavailable PIN returns a generic 401;
20 failed attempts on one bin in a minute cause 429 (persisted bin events contain no PIN).
There is also per-instance HTTP throttling. Deployment-wide IP protection belongs at the edge;
the in-memory throttler alone is not a distributed rate limiter.

Session defaults: 300 seconds (five minutes) of inactivity, renewed after accepted deposits. Re-entering the
same account PIN at the same controller resumes its active session. Expired sessions are closed
lazily on session start/read. A different user's PIN cannot replace an active session, even after
30 seconds without a deposit; it returns 409 until expiry or an explicit end by the owner.
A user with an active session at another bin receives 409. Bin/account uniqueness,
row locks and serializable retries protect concurrent starts. Replaced/closed sessions are never
reassigned, so late deposits cannot credit the new occupant. No timeout can perfectly detect
physical departure without a firmware end signal; brief waits and rejected late submissions remain possible.

### POST /akubin/sessions/:id/deposits

```json
{
  "binId": "AKUBIN-001",
  "userId": "001234",
  "material": "metal",
  "weight_g": 100,
  "points": 2.5,
  "idempotencyKey": "AKUBIN-001-12345-6789"
}
```

- Accepts metal/plastic/paper. Ignores `userId` and `points`: ownership comes from the session;
  reward calculation uses configured points-per-kg rates and decimal arithmetic.
- Normalizes grams to 3 decimal places (firmware uses floating measurements), then converts to kg
  and rounds awarded points once to 6 places. Minimum weight is 5g; configured maximum defaults to 100kg.
- Session, bin, controller and supported material must match. The points ledger INSERT trigger
  updates the wallet; application code never increments that balance a second time.
- Device + body idempotency key identifies one event. Exact retries return the original deposit,
  including after the session ends. Changed session/material/normalized weight with the same key
  returns 409. Retries cannot generate additional credit or notifications.
- Returns 200 with `depositId`, `sessionId`, `points`, current `balancePoints`, and `duplicate`.
- Transactions include deposit, ledger, session renewal and notification. Missing rates fail before
  session start; revoked controllers, unavailable bins and expired sessions reject new deposits.

### POST /webhooks/akubin-telemetry

```json
{ "binId": "AKUBIN-001", "distance_cm": 10, "isFull": true, "timestamp": 12345 }
```

`timestamp` is unsigned 32-bit device uptime, not Unix time. Server receipt time is stored separately.
The backend derives FULL from valid distance `2 < distance < 15` cm rather than trusting `isFull`.
The raw reported flag is retained for diagnosis. `999`, near-zero and readings beyond 500cm are
sensor faults: they cannot clear FULL; an online bin becomes offline. Maintenance is not cleared
automatically. Valid recovery clears FULL, but offline availability needs staff confirmation.
Capacity percentage is the last recorded operational/full reading, not a calibrated conversion
from distance; collection records reset it. The firmware provides no calibrated empty-bin height.
Returns 200 with telemetry ID, bin code, status, sensor validity and receipt time.

Hardware access: `authenticated` controllers send `X-Akubin-Device-Key`. The unchanged firmware
sends no credential, so its controller must explicitly use `legacy_bin_id` and the server must
enable that pilot mode. A public bin ID is not authentication; this implementation does not remove
the firmware's impersonation risk. No Wi-Fi secrets, PINs or device keys are written to audit events.

## Public and account endpoints

| Method | Path                          | Authentication / purpose                                                      |
| ------ | ----------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/akubin/bins`                | Public filtered/paginated bin catalogue; `city`, `status`, `material`         |
| GET    | `/akubin/locations`           | Alias of `/akubin/bins`                                                       |
| GET    | `/akubin/bins/:code`          | Public details by printed bin code, not UUID                                  |
| GET    | `/akubin/locations/:code`     | Compatible alias                                                              |
| GET    | `/akubin/reward-rules`        | Public rates per gram/kg, naira reward value and thresholds                   |
| GET    | `/akubin/rewards`             | Public active reward catalogue                                                |
| GET    | `/akubin/leaderboard`         | Logged in; `period=week                                                       | month | all`, optional city; Monday/month UTC boundaries |
| GET    | `/akubin/me/pin`              | Logged in; configured/lock status only                                        |
| PUT    | `/akubin/me/pin`              | Logged in; `{ pin, currentPin? }`; current PIN required if already configured |
| GET    | `/akubin/me/summary`          | Logged in; own available/lifetime points, verified weight and activity totals |
| GET    | `/akubin/me/wallet`           | Logged in; own available points                                               |
| GET    | `/akubin/me/points-ledger`    | Logged in; own credits/debits                                                 |
| GET    | `/akubin/me/deposits`         | Logged in; own deposit history                                                |
| GET    | `/akubin/me/sessions`         | Logged in; own session history                                                |
| GET    | `/akubin/me/sessions/:id`     | Logged in; own session only                                                   |
| POST   | `/akubin/me/sessions/:id/end` | Logged in; end own session from app; optional for unchanged firmware          |
| GET    | `/akubin/me/redemptions`      | Logged in; own redemption history                                             |
| POST   | `/akubin/redemptions`         | Logged in; `{ rewardId, idempotencyKey, phone? }`                             |

Lists use `page=1&limit=20`, with limit capped at 100. Public bin data excludes controller credentials
and internal histories. PIN setup stores a secret-keyed HMAC lookup and Argon2id verification hash.
Changing a PIN ends active sessions. Five wrong current-PIN attempts lock changes/identification
for 15 minutes. A forgotten PIN needs a separately designed support/re-authentication recovery flow;
there is no insecure reset-by-user-ID endpoint.

Redemption reserves stock and debits points exactly once, returning `pending_review` even if an
old catalogue row says automated. Thresholds and stock are checked server-side. There is no live
airtime/payment provider integration, and approval alone does not mean money or airtime was sent.

## Staff endpoints

All require Supabase bearer authentication and active database staff membership. Public role
switching cannot grant access. Paths use bin UUIDs returned by creation unless stated otherwise.

| Method | Path                                                           | Role / behavior                                                               |
| ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/admin/akubin/bins`                                           | super/operations; list bins                                                   |
| POST   | `/admin/akubin/bins`                                           | super/operations; register physical location                                  |
| PATCH  | `/admin/akubin/bins/:id`                                       | super/operations; details/status/collector/schedule                           |
| GET    | `/admin/akubin/bins/:id/devices`                               | super/operations; controller history without hashes                           |
| POST   | `/admin/akubin/bins/:id/devices`                               | super/operations; `{ serialNumber, authMode }`                                |
| DELETE | `/admin/akubin/devices/:id`                                    | super/operations; revoke and close sessions, never delete history             |
| GET    | `/admin/akubin/bins/:id/events`                                | super/operations; operational history                                         |
| GET    | `/admin/akubin/bins/:id/telemetry`                             | super/operations; sensor history                                              |
| POST   | `/admin/akubin/bins/:id/collections`                           | super/operations; `{ collector, note?, nextCollectionAt? }`                   |
| GET    | `/admin/akubin/bins/:id/maintenance-tickets`                   | super/operations; maintenance history                                         |
| POST   | `/admin/akubin/bins/:id/maintenance-tickets`                   | super/operations; `{ issue }`; places bin in maintenance                      |
| POST   | `/admin/akubin/bins/:id/maintenance-tickets/:ticketId/resolve` | super/operations; resolves issue; does not auto-unlock bin                    |
| PATCH  | `/admin/akubin/reward-rules`                                   | super/finance; configure rates/value/thresholds                               |
| POST   | `/admin/akubin/rewards`                                        | super/finance; create manually fulfilled catalogue reward                     |
| DELETE | `/admin/akubin/rewards/:id`                                    | super/finance; archive catalogue entry                                        |
| GET    | `/admin/akubin/redemptions`                                    | super/finance; review queue/history                                           |
| POST   | `/admin/akubin/redemptions/:id/decision`                       | super/finance; `{ decision: "approve"                                         | "reject", reason? }`; rejection requires reason |
| POST   | `/admin/akubin/redemptions/:id/fulfillment`                    | super/finance; `{ provider, reference }`; records an already fulfilled reward |

Rejection returns reserved points and stock once. A repeated identical decision is idempotent;
conflicting/late decisions return 409. Fulfilment requires approval and a staff-verified external
receipt/reference (or physical collection receipt). It does **not** send payments/airtime. A repeated
identical reference is idempotent; fulfilled rewards cannot be rejected/refunded through this endpoint.
Authenticated controller keys are returned once when registering; hashes are never returned.
No bin, rates, balances, staff roles or redemptions are silently seeded on application startup.

## Setup before connecting hardware

1. Existing schema migrations must already be applied.
2. Set `AKUBIN_PIN_LOOKUP_SECRET` to a stable random secret of at least 32 characters, for example
   generate one using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Keep it server-only. Changing it requires PIN re-enrollment, because existing lookups cannot be recovered.
3. For the unchanged firmware only, set `AKUBIN_ALLOW_LEGACY_HARDWARE=true` in the backend environment.
4. Bootstrap the intended operator's existing profile into `staff_memberships` through a trusted database
   administration path. There is deliberately no public staff-role assignment route.
5. Using an operator bearer token, register `AKUBIN-001`, register its actual controller serial as
   `legacy_bin_id`, and mark the bin online after physical inspection.
6. Using a finance/super bearer token, configure the firmware's actual rates:

```json
{
  "pointValueNaira": "20",
  "rates": [
    { "material": "metal", "pointsPerGram": "0.025" },
    { "material": "plastic", "pointsPerGram": "0.005" },
    { "material": "paper", "pointsPerGram": "0.002" }
  ]
}
```

7. A depositor signs in and provisions a unique PIN using `PUT /akubin/me/pin` before visiting.

Optional config: `AKUBIN_SESSION_TTL_SECONDS=300`,
`AKUBIN_MAX_DEPOSIT_GRAMS=100000`. The firmware's own estimates remain hard-coded, so keep backend
rates and point value aligned until firmware is deliberately changed. The reward-rules endpoint
does not magically update a device that never calls it.

## Validation and remaining hardware limits

`npm.cmd run test:akubin` compiles and runs HTTP tests through actual Nest routing, guards, DTOs,
Prisma, PostgreSQL SQL and wallet triggers against a disposable PGlite database. Supabase Auth is
stubbed; no .env/production services are loaded. `npm.cmd run test:schema` covers migration integrity.
The embedded database uses one connection and does not replace multi-connection load testing or
a real Supabase + hardware staging run.

Unchanged firmware still lacks persistent retry delivery, a session-end signal and device credentials,
and requests points before mechanical sorting. Backend validation cannot prove an item physically
dropped or recover requests the hardware never delivered. These limits are not disguised by the API.
