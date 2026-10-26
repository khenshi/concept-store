# Runtime operations

Implemented and validated October 25, 2026. Includes the provider-agnostic
frontend runtime, same-origin API routing contract, and the Resend mail boundary.

## Build and startup

From `backend/`, run `npm run build`, then `npm run start:prod`. The production
command executes `node dist/src/main.js`; Nest's build clears previous output.
From `frontend/`, `npm run start` defaults to port 3001 and honors an assigned
`PORT` without changing the development command. When same-origin routing is
enabled, the server-only `NEXT_API_UPSTREAM_URL` must be a fixed origin and
`NEXT_PUBLIC_API_URL` must be the public frontend origin plus `/api`.

Repository CI runs separate frontend/backend verification plus a built Nest
readiness and built Next `/api` proxy smoke. It uses Node 20.19.4, synthetic
credentials and disposable PostgreSQL only; it does not deploy, seed or migrate
an application database. See [CI verification](../development/ci-verification.md)
for commands and current baseline limitations.
Startup validates configuration and performs a bounded database connectivity probe
using the existing Prisma adapter pool before serving HTTP. Failure exits nonzero
with a generic `API startup failed` diagnostic, without raw configuration/error
details. Existing validated PORT, Helmet, CORS, DTO and shutdown behavior remain.

## Email delivery

Production requires `EMAIL_PROVIDER=resend`, a Resend API key in
`RESEND_API_KEY`, and a verified sender in `EMAIL_FROM` such as
`Kapwesto <no-reply@example.com>`. The backend sends verification, password-reset,
and invitation messages directly to Resend with a bounded ten-second request
timeout. Provider failures are recorded as sanitized warnings and do not roll
back the already-saved account token or invitation. Development and tests may set
`EMAIL_PROVIDER=disabled`; this intentionally returns Copy link/manual recovery
behavior without sending messages.

Do not boot against ambient application credentials for smoke tests. The opt-in
`npm run test:runtime` requires a separately verified disposable localhost database
and named container. It deliberately pauses/unpauses only that test container;
never point it at a store database. See the dated validation record for setup.

## Logging

Application/error output remains enabled at LOG_LEVEL. LOG_HTTP_REQUESTS controls
automatic HTTP access records only; production still defaults it off. Development
pretty output and production structured JSON remain. A focused exception filter
logs one generic unexpected/5xx failure and returns a generic server error; existing
non-5xx HttpException payloads/statuses remain unchanged.

Error objects are sanitized before Pino can copy their message to `msg`, and the
error serializer omits raw stack/message data. Operational messages/status/context
remain useful. Credential redaction and sensitive query-key redaction remain;
organization-invitation and auth recovery/verification token paths are redacted.
Structured nested credential/contact/reference/body/command fields and exception
contexts are sanitized with bounded traversal. Request serialization omits bodies
and headers; unknown query values (including search) are redacted, while bounded
pagination/status/sort filters remain useful. Call sites must still use static
safe messages: arbitrary interpolated strings are not a general secret scanner.

Production configuration rejects `LOG_DB_QUERY_PARAMETERS=true` and
`SWAGGER_ENABLED=true`; a boolean cannot authorize public production UI/JSON docs.
Nonproduction diagnostics remain configurable. Direct mode explicitly disables
Express proxy trust and uses the socket peer; hosted proxy identity, request-ID
provenance and deployment proof remain gated on Plan 05. The Next proxy does not
accept a client-selected upstream, and no auth response may be cached or retried
by this routing contract.

## Health contracts

| Route             | Response                                                         | Meaning                                                            |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| GET /             | 200 `{ "status": "ok" }`                                         | Existing process-status compatibility.                             |
| GET /health/live  | 200 `{ "status": "ok" }`                                         | HTTP process responsive; no DB work.                               |
| GET /health/ready | 200 `{ "status": "ready" }` or 503 `{ "status": "unavailable" }` | Initialized, not draining and bounded connectivity probe succeeds. |

Health routes are public and disclose no tenant objects, connection details,
SQL or stacks. `/health/*` returns Cache-Control: no-store, including throttled
responses. Polling is bounded to 120 requests/minute per endpoint per process,
separate from normal user buckets; requests cannot evade it using forwarded IPs.
429 indicates polling over budget, not a failed DB probe. Multi-instance and host
polling policies still require Plans 03/05/06 qualification.

Readiness shares one in-flight static `SELECT 1` operation and reuses the connected
adapter's existing pool. Acquisition uses DB_CONNECTION_TIMEOUT_MS (default 10s,
validated maximum 60s); execution uses a local 1s query timeout. A failed/timed-out
query destroys its checked-out connection; no Promise.race orphan or extra pool.
Thus the acquisition-plus-query budget is approximately configured acquisition
timeout plus 1s, not a universal 1s endpoint deadline. Existing business-query
timeouts are unchanged. Choose deployment polling/deadlines against this budget.

Shutdown marks Prisma/health draining before disconnect; new probes report false,
the current bounded flight finishes, then Prisma disconnects. Liveness does not
depend on DB availability. A temporary DB failure after boot makes ready return
503 and later recover without restarting the API or writing business records.

SELECT 1 proves connectivity only. An empty database can be ready: it does not
prove migrations, schema compatibility, financial invariants or release safety.
Plans 04/06 own target/migration gates and authorized schema-dependent smoke reads;
never route real traffic solely because `/health/ready` returns 200.

## Database migration boundary

The backend exposes a read-only `npm run prisma:migration:preflight` command for
an explicitly supplied target. It verifies the target database/schema identity
and compares Prisma migration names and checksums with repository files, stopping
on an unresolved failed latest attempt, unknown, reordered or drifted history. A
resolved failed attempt followed by a later successful attempt for the same
migration is retained as history but evaluated by its latest attempt. The
command never falls back to runtime URLs, runs migrations, resets data or
authorizes deployment. Empty and upgrade-needed states require a separate
reviewed rehearsal and release gate.

Plan 08 adds a development-only account cutover boundary. Its forward migration
must be applied through the normal migration chain on a verified disposable
database and intentionally stops when Sale or Refund rows already exist. For a
fresh development dataset, set `DIRECT_DATABASE_URL` to the exact disposable
target for `npm run prisma:migrate:deploy`, then run the guarded seed with
`DEMO_DATABASE_URL`, `SEED_DEMO_DATABASE_NAME`,
`SEED_DEMO_CONFIRM=I_UNDERSTAND_DISPOSABLE_DEMO_RESET` and
`NODE_ENV=development` or `test`. The seed never accepts the application
`DATABASE_URL`, and remote reset requires separate explicit remote-target
confirmation. Verify Cash/account counts and report totals before starting the
matching API/frontend versions. Existing financial rows require a separately
approved preservation migration; do not use the demo reset as one.

## Verification and limits

See [October 25 runtime validation](../validation/production-runtime-2026-10-25.md).
Actual hosted proxy behavior, monitoring/alerts, host polling/grace budgets,
migration compatibility and transaction shutdown/recovery qualification remain
with their pending plans. The verified development Neon migration/reset/seed
cutover and hosted qualification are recorded separately in the Plan 08
validation evidence. This is not production migration or recovery proof.
