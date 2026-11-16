# Frontend API implementation

Required signup fields, the four account roles and the independent AkuBin option
are documented in [Signup requirements](SIGNUP_REQUIREMENTS.md). Buyer/seller order
and offer lists now accept `mode=buyer|seller` with server-side pagination.

All feature routes use `/api/v1`. Development Swagger: `/docs`; JSON: `/docs/json`.
The offline [OpenAPI document](openapi.json) contains request bodies, enums and query parameters;
[ENDPOINTS.md](ENDPOINTS.md) lists the registered operations. Regenerate both after building with
`npm run api:export`. The root welcome route and health checks remain unversioned.

## Module arrangement

Each feature owns its controller, service and `dto/` folder under `src/modules/`:

| Module | Responsibility |
| --- | --- |
| `auth` | Existing Supabase signup, email/recovery OTP, login, refresh, logout and OAuth |
| `users` | Own profile, preferences, onboarding and marketplace dashboard |
| `verification` | Basic/full applications, private attachments and staff review history |
| `uploads` | Multipart file storage and attachment-aware signed download links |
| `listings` | Browse/search, own drafts, stock, saves, reports, moderation and seller reviews |
| `offers` | Buyer/seller negotiation, counteroffers, rejection and acceptance |
| `buyer-requests` | Buyer demand notices, seller responses and buyer shortlisting |
| `orders` | Order detail/timeline, delivery estimates, quote selection, cancellation, receipt and disputes |
| `partners` | Logistics applications/documents, approval, jobs, quotes, delivery progress and proof |
| `payments` | Paystack checkout, verification, webhooks, payout recipients, refunds and settlements |
| `content` | Published articles, saved articles, moderated news and editorial CRUD |
| `advertising` | Priced packages, campaigns, moderation, placements and signed engagement tracking |
| `recommendations` | Visible listing/article/job suggestions and feedback events |
| `assistant` | Stateless session chat through a configured HTTPS AI service |
| `notifications` | Own notification list/unread count, read-one and read-all |
| `support` | Contact tickets, public enquiries, own tickets and staff queues |
| `admin` | Staff identity, users, orders, finance records, audited settings and settlement holds |
| `akubin` | Existing hardware/session/deposit/PIN/points/rewards/operations endpoints |

Shared authorization, pagination, transaction retry and trading policy live in `common/platform`.
The Paystack HTTP adapter lives in `integrations/paystack`. Payment orchestration stays in its feature module.
Prisma models retain their existing family folders; `payments/payout-recipient.prisma` is the only new model.

## Setup

1. Apply checked-in migrations to the intended development database with
   `npx prisma migrate deploy`. Do not reset an existing database. Then run `npm run db:generate`.
   This implementation does not apply remote migrations automatically.
2. Configure `.env` using `.env.example`. Use Paystack **test** credentials while integrating.
3. Create the Supabase Storage bucket named by `UPLOADS_BUCKET` as **private**. All file access is
   issued by the backend; verification and partner documents must never be in a public bucket.
4. Bootstrap the first verified administrator using the server allowlisted profile and
   `POST /admin/staff/bootstrap`, then manage roles with super-only `GET /admin/staff` and
   `PUT /admin/staff/:profileId`. See [staff access](STAFF_ACCESS.md) for setup and safeguards.
5. As `super`, call `POST /admin/settings` once, then `GET` and `PATCH /admin/settings` to configure
   real fees, fare base/per-kg/step, quote deadlines and inspection hours. Defaults do not invent
   usable delivery prices. Include the returned `version` in each update; stale edits return 409.
6. Configure active advertising packages via `PUT /admin/advertising/packages`. Prices and duration
   are copied from the selected package, never accepted from an advertiser.
7. Set the Paystack webhook URL to `https://<backend>/api/v1/webhooks/paystack`. Set
   `PAYSTACK_CALLBACK_URL` to the frontend payment-return page. That page reads the payment ID
   stored before redirect, calls `POST /payments/:id/verify`, then refreshes its order/campaign.
   Redirect query parameters alone cannot mark a payment successful.

The PostgreSQL connection should use UTC session time, as expected by the Prisma PostgreSQL adapter.
`PAYSTACK_TRANSFERS_ENABLED` defaults to false. Enable it after configuring the merchant balance,
transfer approvals and required payout accounts in Paystack. A Paystack checkout is not an escrow
product: `held` is AkuMart's internal obligation to withhold marketplace payouts. Merchant settlement
and funding settings must support that obligation. Transfer OTP/approval may leave a transfer
processing; only a verified provider success completes it.

## Contracts and access

- Send `Authorization: Bearer <Supabase access token>` to authenticated routes. User IDs come from
  validated tokens. Listing/offer/order ownership is checked on the server.
- Responses usually use `{ data }`; paginated results use `{ data, pagination: { total, page, limit } }`.
  Keep decimal quantities, prices and balances as strings. Prices are NGN major units; only the
  Paystack adapter converts them to kobo. Upload sizes are serialized as strings.
- Pagination accepts `page` (default 1), `limit` (default 20, max 100), optional `search`.
  Listing search also supports material, city, minPrice, maxPrice, excludeId and sort.
- Basic approved, unexpired verification and accepted terms enable trade. Full verification must
  match the basic verification type; buyer and seller need full verification before checkout.
  `marketRole`, `activeMode` and `akubin` are user preferences, not authorization roles.
- Staff roles: `operations`, `support`, `finance`, `content`, `super`. `super` can access all staff
  operations. Staff cannot approve their own verification/application/campaign, moderate their own
  listing or decide/release their own marketplace transaction.
- Mutations return 400 for invalid input, 401 for missing/invalid authentication, 403 for missing
  permissions/verification, 404 for inaccessible private resources and 409 for conflicting states.
  Missing configured providers return 503; upstream failures return 502.
- Account-sensitive mutations and public submission endpoints are throttled. The default limiter
  is per process; a multi-instance deployment needs shared throttler storage for global limits.

## File flow

`POST /uploads` is multipart: field `purpose` plus one binary `file` (up to 3 MiB).
Supported types: JPEG, PNG, WebP and PDF; listing/campaign/article creatives require an image.
The backend checks the signature against the supplied MIME type. It does not claim malware scanning
or identity-document verification from those checks.

Attach the returned upload ID to the relevant request:

- Listing: `imageIds`, ordered as supplied; reads return `{ uploadId, position }`.
- Verification: `documents: [{ uploadId, kind }]`.
- Partner: four documents with kinds `cac`, `owner_id`, `vehicle_registration`, `insurance`.
- Delivery: `uploadId` on the assigned partner's proof endpoint.
- Dispute: `uploadIds` on the buyer's dispute endpoint.
- Campaign/article: `imageId`.

Files must be ready, owned by the submitting account and have the matching purpose. Purpose values
are in OpenAPI's `UploadPurpose` enum. `GET /uploads/:id/access` returns a five-minute signed URL
after checking actual attachments and access rights. Public access is limited to published listing/
article images and currently running, approved, paid campaign creatives. Identity documents remain
private. Buyer/seller can access order evidence; finance can access delivery/dispute evidence.

## Marketplace transaction sequence

1. Seller uploads images and creates a listing. `quantity` is total stock;
   `availableQuantity = quantity - reservedQuantity - soldQuantity`.
2. Buyer sends `POST /listings/:id/offers` with `unitPrice`, `quantity`, `conditions`.
   Participants counter/reject/accept on their turn; offers expire after 72 hours.
3. Acceptance atomically creates one order, snapshots commercial terms and reserves stock.
   Repeating acceptance returns the same order. Competing acceptances cannot oversell.
4. Buyer reads `GET /orders/:id/logistics/estimate`, then posts `destination` and `proposedFare`
   to `/orders/:id/fulfilment`. Kilograms and tonnes are converted consistently. Fare must match
   the configured step and range. The estimate is based on weight, not invented route distance.
   Approved partners must serve the pickup city, material and load capacity; no self-pickup route
   bypasses the logistics workflow. No eligible partner yields `no_quotes`.
5. Partners see general pickup/load details only, then quote `amount`, `eta`, `vehicle`.
   Buyer reads quotes and selects one. Exact destination/contact information becomes visible
   to the assigned partner. `POST /orders/:id/quotes/extend` refreshes an unassigned request,
   expires old quotes and reopens the configured quotation period.
6. Buyer initializes checkout, stores the returned payment ID and opens `checkoutUrl`.
   Neither success sent by the browser nor a redirect grants paid status. Server verification
   checks reference, amount and currency; then stock moves from reserved to sold exactly once.
7. Assigned partner posts `picked_up`, `in_transit`, `delivered`, then a proof upload.
   Proof opens the order's snapshotted inspection window. Buyer confirms receipt or disputes.
8. Finance releases a confirmed, unblocked order. Seller needs current full verification;
   seller and partner must have payout recipients. Fees are deducted from their respective
   proceeds, not added to the buyer's payment. Only verified successful transfers mark settled.
9. Buyer can review a settled order once. Reviews displayed on seller pages are genuine settled
   order reviews; empty sellers have no invented score.

Cancellation is buyer-only and releases stock once for an unpaid order **without a pending payment
attempt**. If checkout was initialized, reconcile that reference first; an unknown provider outcome
must not free stock while a payment may still succeed. Verified failed/abandoned attempts permit
another checkout. A retained pending reference after timeout needs reconciliation before a new
attempt; the backend never invents failure to unblock a financial operation.

Buyer requests provide a separate demand-board flow; response shortlisting does not itself reserve
stock or create an order. A seller sees only their own responses, while the buyer sees all responses.

## Refunds, disputes and reconciliation

Buyer disputes require a held payment and delivered/proof-uploaded order within the inspection
window. They create a settlement hold. Finance decides `release`, `refund` or `partial` with an
audited reason. Full refund returns merchandise plus delivery. A partial refund must be positive
and less than merchandise value; it reduces seller gross, leaves logistics gross unchanged and
recalculates percentage fees against the adjusted seller gross. This is the implemented allocation
policy. The order can be paid out only after the refund has actually completed.

Refunds and transfers persist a stable provider reference before external calls. A timeout leaves
the record pending for retry/reconciliation. `POST /admin/refunds/:id/retry` retries a pending
request with the **same** reference. Finance can reconcile transfers/refunds using the corresponding
reference routes. A provider-final failed/reversed operation requires finance investigation;
the API does not automatically create a replacement payment or payout. A rejected advertising
campaign that never ran can receive a full refund via `/admin/advertising/campaigns/:id/refund`.

Webhooks use exact raw request bytes. The implementation supports timestamped `Paystack-Signature`
with `PAYSTACK_WEBHOOK_SECRET` and the legacy `x-paystack-signature` using the API secret.
Invalid modern signatures cannot fall back to legacy verification. Events are deduplicated and
reconciled against Paystack before updating balances/status. Failures remain in the webhook inbox
and return an error so Paystack can retry. The webhook currently processes synchronously; there
is no background worker or automatic inspection-window settlement task.

Provider contracts: [transactions](https://paystack.com/docs/api/transaction/),
[webhooks](https://paystack.com/docs/payments/webhooks/),
[refunds](https://paystack.com/docs/api/refund/),
[transfers](https://paystack.com/docs/api/transfer/).

## Recommendations and assistant

`GET /recommendations/listings`, `/articles`, `/jobs`, and `/listings/:id/similar` return actual,
visible application records. Current algorithm: `preferences-recency-v1`; these are deterministic
suggestions based on interests, locality/material, recency and eligible partner notices. Dismissed
listing recommendations are excluded. They are **not** represented as trained AI predictions.

`POST /assistant/messages` accepts `{ sessionId, message, history? }`. `sessionId` is a fresh UUID per temporary chat. History contains at most 12 `{ role: "user" | "assistant", content }` entries; current message is separate (maximum 3000 characters). Auth is optional; the backend derives `user_id` from the verified bearer token, never from the request body.

Set `ASSISTANT_API_URL=https://akubin-ai-classifier.vercel.app/api/v1/ai/support/messages`. `ASSISTANT_API_KEY` is optional and server-only. The relay sends `user_id`, `session_id`, `message`, and `conversation_history`. It returns `{ data: { reply, escalateToHuman, quickSuggestions, relatedRoutes } }`. Failures return 502; missing configuration returns 503. It has no authority to mutate marketplace or support records.

No conversation/message database writes or server-side history cache are used. The frontend holds chat in React memory only, clears it after 30 minutes without bot interaction, refresh/unmount, logout, account change, or New chat. Closing the panel preserves history until expiry. Only the recent 12 messages are sent as context. The old `GET /assistant/conversations/:id` returns 410; existing historic rows are not read or deleted by this change. The external AI service's own logging/retention must be configured separately.

Replies render as plain text. Related routes are allowlisted by the frontend. Escalation offers the existing Contact support flow; it does not silently save a ticket or transcript. The existing camera classifier is unchanged.

## Validation

- `npm run test:platform`: disposable PostgreSQL migrations + HTTP feature integration tests;
  Supabase Auth/Storage and Paystack responses are stubbed, with real signature verification.
- `npm run test:akubin`: existing smart-bin regression suite.
- `npm run test:schema`: database constraint/ledger integrity suite.
- `npm run build`, `npm run lint`, `npm run db:validate`.

No external payment, transfer, refund, storage upload, AI request or remote migration is performed
by these tests. Complete a Paystack test-mode round trip and a private Supabase bucket smoke test
with your account before enabling production money movement. The frontend currently still uses
its local demo store; replacing those calls with this API is a separate integration step.
# Supplier response revisions

`POST /api/v1/buyer-requests/:id/responses` creates a response, or resubmits
revised terms when the supplier's current response is declined. Sent and shortlisted
responses reject duplicate submissions with 409. Resubmission retains the response ID.

`PATCH /api/v1/buyer-requests/:id/responses/:responseId/terms` edits the supplier's
own sent response. Send `unitPrice`, `quantity`, `note` and required ISO
`expectedUpdatedAt` from the latest response. Price and quantity are decimal strings.
Shortlisted/declined edits, closed/expired requests and stale versions return 409.
Declined responses use the POST route to return to sent.

Buyer decisions use the existing PATCH response route with status shortlisted or
declined. Include `expectedUpdatedAt` to avoid reviewing terms changed since loading.
The frontend sends this token on edits, resubmissions and decisions. Revisions and
decisions record before/after terms in the audit log.

One unexpired active offer per buyer/listing is allowed. Use counteroffers to continue
an active negotiation; duplicate creation returns 409 with the existing offer ID.
`GET /users/me/offers?mode=buyer&listingId=:uuid` finds that listing's negotiations.



### Listing bookmark eligibility

Saving a listing is available to Buyer accounts and Buyer & Seller accounts while in buyer mode, and only for another seller's published, eligible listing. The backend enforces ownership and role/mode checks within the save transaction. The frontend hides the bookmark for owners, seller-only accounts, seller mode, recyclers, and logistics accounts. Guests can sign in from the bookmark. Saving is not a trade and does not require buyer verification. Existing bookmarks can still be removed after changing roles or mode; saved-list retrieval excludes your own listings. Article bookmarks are independent.


### Marketplace action visibility and listing access

Marketplace actions follow the backend profile's current trading mode. Buyers see Post a buyer request; sellers see Sell your materials and Find buyer requests; dual-role accounts follow their active mode. Guests see Sign in to trade; recycling/logistics-only accounts have no trading actions. Direct access to My listings or the listing editor is blocked outside seller mode. Listing creation/updates require seller mode and the existing marketplace verification; buyer-request creation requires buyer mode and verification. Backend role checks apply even if the frontend is bypassed.
