# AkuMart database design

The Prisma schema is split by domain. `prisma.config.ts` points at this directory;
Prisma recursively combines the domain folders' `.prisma` files into one client and one migration history.
Each model has its own file. Shared enums also have one file per enum under `shared/enums/`.
See [Prisma's multi-file schema documentation](https://docs.prisma.io/docs/orm/v7/prisma-schema/overview/location).

## Domain map

| Folder/file | Models and responsibility | Future Nest module |
| --- | --- | --- |
| `schema.prisma` | Generator and PostgreSQL datasource | `integrations/database` |
| `shared/enums/` | Explicit statuses, material types and roles | Shared generated types |
| `accounts/` | Profile, preferences, PIN security, consent history and staff membership | `modules/users` |
| `uploads/`, `verification/` | Stored files, verification submissions and document links | `modules/uploads`, `modules/verification` |
| `marketplace/` | Listings, images, saves, reports, offers/steps and buyer requests/responses | `modules/listings`, `modules/offers`, `modules/buyer-requests` |
| `orders/` | Order snapshots/events, reviews and disputes/evidence | `modules/orders` |
| `logistics/` | Partner applications/documents, job notices, quotes, assignments and proof | `modules/logistics`, `modules/partners` |
| `payments/` | Payment attempts, refunds, settlements, beneficiary transfers, holds and webhook inbox | `modules/payments` |
| `akubin/`, `rewards/` | Bins/devices, sessions, deposits, points wallet/ledger, rewards/redemptions and operations history | `modules/akubin`, `modules/rewards` |
| `content/`, `advertising/` | Articles/saves, news, advertising packages, campaigns and engagement events | `modules/content`, `modules/advertising` |
| `support/`, `notifications/`, `audit/`, `settings/` | Support, enquiries, notifications, audit history and business settings | `modules/support`, `modules/notifications`, `modules/admin` |
| `recommendations/`, `assistant/` | Recommendation activity and assistant conversations/messages | `modules/recommendations`, `modules/assistant` |

The feature modules and endpoints are now implemented. See [frontend API setup and workflows](../docs/FRONTEND_API.md)
and the [registered route inventory](../docs/ENDPOINTS.md). Historical design notes below describe the
schema constraints; current request contracts are defined by feature DTOs and the exported OpenAPI document.

## Accounts and compatibility

- `Profile.id` is the existing Supabase `auth.users.id`. Prisma does not own `auth.users`.
- The original migration's foreign key and signup trigger are retained, unchanged.
- Existing profile columns are retained so registration, `me()` and OAuth still compile.
- `displayName`, `phone`, `city` and `onboardedAt` are additive. `city` is the structured locality;
  `location` remains a free-form location/address, not an alternative city source.
  The compatibility flag `profileCompleted` must equal `onboardedAt != null` (database CHECK).
  Onboarding writes both in one statement. For old true flags without an event timestamp, the
  migration uses the existing `updatedAt` as a legacy estimate, not proof of the exact completion time.
- `UserPreferences` stores role, enabled AkuBin preference, material interests and active mode.
  Absence of an active mode is allowed; it must match the marketplace role when specified.
- `UserSecurity` identifies a depositor from a permanent PIN entered at a physical AkuBin.
  It is separate from profile responses. `pinLookupHash` is a unique, lowercase hex HMAC-SHA256
  computed using a dedicated server-only secret; `pinHash` is a separate slow salted verification
  hash (e.g. Argon2id). Hash the exact validated PIN string, preserving leading zeros.
  The future service finds the security record by lookup hash, checks lockout and verifies
  `pinHash`, then starts a bin session linked to `profileId`. Provision/change both hashes
  atomically; handle the unique constraint if another account already uses the PIN.
  Neither plaintext PINs nor either hash should be logged, returned to clients or used as a session ID.
  Failed attempts and lockout are stored here; unknown PINs also require endpoint/bin-level throttling
  because they have no account row to increment. PIN length and provisioning rules are not yet defined.
  Existing salted hashes cannot be backfilled without users entering/resetting their PIN.
  Keep the HMAC secret stable: changing it requires an explicit re-enrollment/rotation strategy.
  This schema change does not implement PIN provisioning or hardware authentication endpoints.
  Passwords and authentication refresh tokens remain exclusively managed by Supabase Auth.
- `ConsentRecord` records document/version acceptance once. No privacy acceptance is fabricated.
  The migration backfills recorded terms and mirrors future writes to the legacy terms fields.
- The migration initializes preferences, security and zero-balance wallets for existing users.
  A profile-insert trigger initializes these for future Supabase signups too.
- Staff roles are database records, not browser-switchable preferences. Granting staff membership
  needs a trusted administrative path; no staff member is seeded.
- Most business/history references use `RESTRICT`. Deleting an auth user with financial, consent
  or business history may therefore be blocked through the existing auth-to-profile cascade.
  Account closure/anonymization needs a deliberate retention workflow before a delete endpoint.

## Commercial data

- Currency amounts are `Decimal(20,2)` in **major units** (NGN naira), not kobo. Convert once
  at the payment-provider boundary. Rates and physical measurements use finer precision.
- All API DTOs must serialize decimals deliberately (normally decimal strings) and BigInt upload
  sizes as strings; do not pass Prisma's raw BigInt values into JSON responses.
- Every order snapshots title, material, quantity, unit, price, fees and inspection window.
  Settings or listing edits must not change an already agreed transaction.
- Listing `quantity` means total stock, not remaining stock. Available quantity is
  `quantity - reservedQuantity - soldQuantity`. Both counters are nonnegative and cannot exceed
  total stock together; zero available quantity is valid. Sold legacy listings initialize
  `soldQuantity = quantity`; reconcile any partially fulfilled legacy orders before enabling sales.
- One `Order` is allowed per `Offer`. Accepting an offer still needs a transaction that checks
  the current turn, expiry, verification, stock and participants, and reserves quantity.
- Offer steps use a per-offer sequence; `version` supports optimistic concurrency.
- One partner quote exists per order/partner. One assignment exists per order and its composite
  foreign key enforces that the selected quote belongs to that order and partner.
- The migration also prevents two selected quote statuses per order. The selection transaction
  must write the quote statuses and assignment together and freeze the agreed fare.
- No self-pickup option is modeled: the current action layer routes fulfilment through logistics.
- Buyer-request shortlisting does not create an order. No unsupported automatic conversion is assumed.
- Composite foreign keys tie each order to its offer's buyer/listing/seller and the listing's seller.
  Reviews and buyer-opened disputes are tied to the order buyer. Reviews are unique per order;
  service logic still requires a qualifying settled order and checks negotiation turns/accepted terms.
- Partner ratings/completed counts and seller ratings are derived, not mutable authoritative counters.
- Payments target exactly one order or campaign; multiple attempts are allowed. Confirmation,
  total captured amount, currency and owner must be verified server-side.
- Refund allocation triggers lock the confirmed payment and cap nonfailed refunds at its amount.
  Refund/dispute order identity is checked, completed refunds cannot release allocations, and
  confirmed payment facts cannot be rewritten. Provider verification and settlement remain
  service responsibilities; settlement must consider refunds, unresolved disputes and active holds.
- Each settlement has separate seller/partner transfer records, supporting independent provider
  outcomes instead of pretending both payouts succeeded together.
- Idempotency keys and provider references prevent duplicate processing; use stable keys across retries.
  Never create a new key just because the same operation was retried.

## AkuBin and rewards

- `Bin.code` is the public human-readable/QR identifier; its UUID remains the relational key.
- Firmware is unchanged. Permanent PIN lookup identifies the depositor; a session is created
  directly as `active` with required account/bin/controller IDs, start/last-activity/expiry/end times.
  There are no temporary codes or `issued` state. Session identity cannot change and closed sessions
  cannot reopen. Expire/close old sessions before replacement in a transaction; one active session
  per account/bin is enforced. The service must define the inactivity timeout and replacement policy,
  and extend lastActivityAt/expiresAt with accepted deposits. No session-end signal is available
  from the current firmware; late deposits for a closed session are rejected rather than reassigned.
- `BinDevice.authMode = authenticated` requires a credential hash. For the current firmware only,
  explicitly configure `legacy_bin_id` with no credential hash. One non-revoked controller per bin
  provides an unambiguous backend mapping from the supplied bin code. This mode does not authenticate
  hardware: knowledge of a public bin ID remains sufficient to impersonate its requests. Use endpoint
  limits/monitoring and do not claim the schema removes this controlled-pilot limitation.
- Composite foreign keys tie a deposit to its session's bin, account and controller. A trigger rejects
  new deposits on closed/expired sessions or revoked devices. Supported materials, measured weight
  plausibility and incoming HTTP authorization still require service validation.
- Hardware `weight_g` converts to kg with decimal arithmetic; `weightKg` has six decimal places
  to preserve subgram readings. `measuredAt` is optional because firmware supplies no wall clock.
  Server receipt time is `createdAt`. `BinTelemetry` separately records reported distance/fullness,
  32-bit device uptime (`millis()`, resets/wraps) and server receipt time. Faulty readings must not
  automatically be interpreted as an empty bin. Telemetry does not prove physical availability.
- The body `idempotencyKey` maps to a stable device-event ID for the mapped controller. Firmware
  retries/reboots are not durable, so backend idempotency cannot recover unreported/lost deposits.
- Count deposits require an integer count. Weight and point-conversion rates are snapshotted.
- The points ledger is append-only history. Its INSERT trigger alone updates the wallet balance
  and version atomically; services must NOT increment the wallet again. Direct balance updates are
  blocked. Duplicate inserts ignored via ON CONFLICT do not change balances. Failed inserts roll
  back both credit and balance. Deposits and redemptions have owner-matching composite foreign keys.
  Credits must equal a verified deposit's awardedPoints; redemption entries must equal costPoints.
  Refund entries require an original debit and rejected/failed status. Credits/refunds are unique
  by source; wallet balance cannot become negative. Credited/debited source facts cannot be edited.
  Zero-point deposits may exist without a ledger entry.
- Wallet balance, signed ledger amounts and awarded deposit points use `Decimal(18,6)` so
  fractional rewards such as `0.025` are preserved. Calculate using decimal arithmetic and
  serialize points as decimal strings; round once to six decimal places when posting a credit
  and use that exact same amount for the deposit and ledger insert. Do not round each
  balance read or convert values to binary floats. Catalogue reward costs and minimum redemption
  thresholds can remain whole-point integers; users may earn fractional points toward them.
- A redemption snapshots reward name, kind, cost and value. Debit points and reserve stock atomically;
  any reversal refunds once and restores reserved stock once. A provider failure is not automatically
  proof that fulfilment did not happen; reconcile before retrying or refunding.
- Leaderboards are derived from verified deposits/ledger activity by date and user city. No seeded
  leaderboard table or invented balance is stored.

## Files, content, operations and AI

- Uploads track storage keys, purpose, MIME type, byte size and readiness. Document joins reference
  actual uploads. Services enforce ownership, allowed purpose, readiness and access permissions.
- `uploadedById` records attribution, not resource ownership; listing/document/proof joins determine
  attachment. Storage keys are unique within a provider. The free-form `isPublic` flag is removed.
  Access URLs must be issued after attachment-aware authorization; verification, partner, dispute
  and proof documents stay private. Storage ACLs and cross-purpose attachment checks are service work.
- A verification submission is an attempt; absence means `not_started`. Read current eligibility
  from the applicable reviewed submission, with service rules for resubmission and full/basic tiers.
  Store provider-specific fields sparingly; encrypt sensitive fields before persistence as needed.
- At most one open verification attempt and one approved attempt per account/tier are allowed.
  Supersede an earlier approval explicitly when replacing it. Append-only verification events
  preserve decisions. Eligibility must check expiry, identity type and basic/full dependency in services.
- Articles/news publication and campaign approval are distinct from payment state. Campaign price
  and duration snapshot a package. Impressions/clicks are deduplicated events; totals are derived.
- Notifications store `readAt`; public enquiries and support allow guests. A guest assistant session
  uses a server-managed session identity hash; conversation UUID alone is not authorization.
- Recommendation results need not be permanently stored. Events provide ranking signals;
  assistant messages can hold structured result references. No vector database/provider is assumed.
- Audit actor/resource IDs and administrative actor IDs on history rows are intentionally historical
  snapshots, not all relational foreign keys. Services validate actual staff membership when acting.
- Settings are one row (`id = 1`); material point rates are separate typed rows. No commercial
  configuration/catalogue is seeded. Review business rates and seed them before enabling trading,
  quoting or rewards; schema defaults are not approved commercial policy.

## Migration and verification

The migration history includes application domains, PIN lookup, fractional points and a forward
`20261114150000_schema_integrity` migration. None has been applied to the user's remote database
by this work. Original migration files were not rewritten. The forward migration preserves file
attribution with a column rename and backfills new ownership links from existing relations.
It rejects unresolved unbound/issued legacy sessions and inconsistent wallet/ledger/refund data
rather than inventing ownership or silently altering financial history. Review those conditions
and actual database drift before deploying. Existing SQL triggers referencing Supabase auth remain.

Additional SQL implements CHECK constraints, partial unique indexes, RLS, account initialization
and consent backfill. These features are not all expressible in Prisma; retain/review them in
future migrations. A schema-only diff is not a complete verification of these SQL features.

All new public tables have RLS enabled and direct `anon`/`authenticated` table privileges revoked.
The backend must connect using a trusted database role with the required privileges/RLS behavior.
There are deliberately no browser Data API policies; public browsing is mediated through NestJS.

Local schema/client checks (no database changes):

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run test:schema
npm.cmd run build
```

`test:schema` replays every migration in disposable in-memory PostgreSQL (PGlite), with minimal
`auth.users`, `anon` and `authenticated` fixtures. It checks populated legacy backfills, signup,
PIN uniqueness, stock bounds, ownership, fractional credits, duplicate retries, session lifecycle,
refund limits and table RLS/privileges. It never loads .env or connects to Supabase. This is not
a hosted Supabase auth/storage integration test or a multi-connection concurrency load test;
review staging migration/roles and real hardware behavior before production deployment.

Only after that review, apply migrations with `npm.cmd run db:migrate:deploy` using the intended
`DIRECT_URL`. This command changes the database; it has not been run as part of schema preparation.
Apply the migration before deploying code generated from these new models: Prisma profile reads
include new scalar columns and will fail against the old database schema.
