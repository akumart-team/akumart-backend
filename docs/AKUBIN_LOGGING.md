# AkuBin request logs

All registered AkuBin public, hardware, account, and admin routes use `AkubinHttpLoggingMiddleware`, including `/api/v1/webhooks/akubin-telemetry`. No extra environment settings or packages are required. Logs appear in the backend terminal and your hosting platform's server logs, under `AkuBinHTTP`. This feature does not write logs to the application database or create a log file.

Each request generates a server-created UUID in the `X-Request-ID` response header. Use it to match `akubin.request.started` with `akubin.request.completed`. Requests disconnected before completion produce one `akubin.request.aborted` event with diagnostic status 499; 499 is not a response sent to the disconnected client.

Completed records include method, endpoint template, authentication mechanism, HTTP status, outcome, elapsed milliseconds, verified account UUID when known, safe bin context, and session UUID when available. A successful hardware session-start response contributes its session ID so later deposit requests can be traced. `auth` describes which credential was presented; it does not mean authentication succeeded.

Log levels:

- INFO (`log`): starts and successful responses.
- WARN: client errors such as 400 validation, 401 authentication/PIN rejection, 403 authorization, 404 missing resources, 409 conflicts, 429 rate limiting, and aborted requests.
- ERROR: server errors (5xx). The request log uses a generic error message; Nest's existing exception logging handles unexpected internal exceptions separately.

Example completion record (illustrative):

```json
{
  "event": "akubin.request.completed",
  "requestId": "00000000-0000-4000-8000-000000000001",
  "method": "POST",
  "endpoint": "/api/v1/akubin/sessions/phone-pin",
  "auth": "none",
  "status": 401,
  "outcome": "error",
  "durationMs": 37.8,
  "binId": "AKUBIN-001",
  "errors": ["Invalid or unavailable PIN."]
}
```

Endpoint path values are replaced with placeholders, and queries, request bodies, response bodies, headers, IP addresses and user agents are not dumped. Only explicitly allowed context is extracted. PINs, identifiers, phone numbers, emails, tokens, device keys and cookies are omitted/redacted from these request logs. Error strings are bounded and stripped of line breaks; only up to eight validation messages are included. Numeric sequences in error messages are conservatively redacted as well. A hardware request cannot supply a trusted `userId` for logging; only the authenticated request identity is recorded.

The middleware runs before guards/pipes, so it captures controller-route authentication, authorization, validation, throttling and handler failures. Failures rejected before route middleware runs (for example malformed JSON rejected by Express's body parser or network/CORS rejection) remain outside this route logger.

Tests use no live DB or email provider:

- `test/akubin-logging.test.cjs`: real Nest HTTP responses, denied guard, validation, safe error messages, session correlation, and disconnects.
- `test/akubin.e2e.test.cjs`: existing disposable PostgreSQL hardware/account/staff regression suite.

Both accept `AKUMART_TEST_BUILD` (default `../dist`, resolved relative to the test file). For isolated testing, compile with `node node_modules/typescript/bin/tsc --project tsconfig.build.json --outDir test-results/compiled --incremental false`, set `AKUMART_TEST_BUILD=../test-results/compiled`, then run `node --test test/akubin-logging.test.cjs test/akubin.e2e.test.cjs`. This avoids replacing the build of an already running backend.
