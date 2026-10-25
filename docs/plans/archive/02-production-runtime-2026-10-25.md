# Plan 02: Production startup, logging and readiness

Date: October 23, 2026

Status: Completed October 25, 2026. Local gates, captured-output logging tests,
deep security review and fresh built-process checks passed on a verified empty
disposable target. See [evidence](../../validation/production-runtime-2026-10-25.md).
No deployment or application database operations performed. Other plans remain pending.

Priority: P0, before real pilot transactions.

## 1. Goal and scope

Make the built NestJS API start through its documented production command, retain
safe operational/error logging independently of optional HTTP access logs, and
provide distinct process-liveness and dependency-readiness signals.

Owns checklist §3 startup/logging and §6 dependency readiness in the
[deployment checklist](../../deployment-readiness-checklist.md). See the
[sequence](../pending/README.md) for other owners.

Included:

- Correct the production entry point using the actual build artifact.
- Separate application logging from automatic request/response logging.
- Add minimal liveness/readiness contracts and tests, reusing Nest and Prisma.
- Verify bounded failures, shutdown behavior and sanitized startup failures.
- Document exact commands, health semantics and environment configuration.

Excluded:

- Passwords, session management, trusted proxy policy and broad redaction changes
  (03); migration/backup/credential policy (04); hosting/domain/cookie decisions
  (05); CI/release orchestration (06); alerts/incidents (10).
- Financial logic, tenant features, schema migrations, background jobs, Redis,
  queues, a generic health framework or new packages.
- Any application DB query/reset/seed, production start or deployment during
  planning. Future live-process proof must use an explicitly verified test target.

## 2. Current architecture and observed weaknesses

Source inspected:

- `backend/package.json`, `nest-cli.json`, `tsconfig.build.json` and existing
  `backend/dist/src/main.js` artifact.
- `backend/src/main.ts`, `app.module.ts`, `app.controller.ts`.
- `backend/src/config/env.validation.ts`, `logging.ts` and their tests.
- `backend/src/infrastructure/database/prisma.service.ts`.
- `backend/test/app.e2e-spec.ts` and controller tests.

Findings verified from current source/artifacts:

1. `start:prod` invokes `node dist/main.js`, but the existing build artifact is
   `dist/src/main.js`. The Nest build configuration includes additional source
   roots; do not restructure the compiler output just to shorten a start command.
2. Production defaults `LOG_HTTP_REQUESTS=false`; `pinoHttpOptions` assigns this
   to Pino's global `enabled`. This disables more than routine access logs and
   can suppress application errors precisely when operators need them.
3. `GET /` always returns `{ status: 'ok' }`. It proves a responding HTTP process,
   not database availability or schema compatibility.
4. Prisma connects during module initialization and disconnects on destruction.
   `main.ts` already enables shutdown hooks and binds the validated `PORT`.
   Reuse those hooks; do not introduce a second pool/client lifecycle.
5. Connection/query timeouts are configured on the existing PrismaPg adapter.
   A probe deadline must address real underlying work, not merely stop waiting
   while accumulating database queries in the background.
6. Logger request serialization includes URLs. Enabling operational logging must
   not introduce token-bearing invitation-path or private exception leaks.
   Plan 03 owns the broader redaction work; this is a coordinated release gate.

Fresh drafting evidence: 13 tests across environment validation, logging and
AppController suites passed on October 23. These existing tests do not prove the
broken production command works or production logging is safe. No fresh build,
real process boot, DB probe, shutdown or deployed check ran during drafting.
The artifact inspected could be older than current source; implementation must
verify from a fresh build. No application database was contacted.

## 3. Proposed changes

### A. Production startup

- After a clean successful existing Nest build, align `start:prod` with the real
  generated entry (`node dist/src/main.js` for the inspected configuration).
- Add a regression check tying the configured entry to the generated artifact;
  do not rely on a stale `dist` tree or confuse successful compilation with boot.
- Preserve environment validation, Helmet, CORS, DTO whitelisting, logger binding,
  shutdown hooks and the host-provided `PORT` contract.
- Invalid configuration or startup dependency failure must exit unsuccessfully
  with a bounded, sanitized diagnostic. Do not dump environment objects, DB URLs,
  JWT secrets or credentials. Handle bootstrap failure deliberately if existing
  behavior cannot satisfy this; avoid a broad bootstrap refactor.

### B. Logging semantics

- Keep application/error logger output enabled at the validated `LOG_LEVEL`.
  `LOG_HTTP_REQUESTS` must control automatic HTTP access logging only, not the
  shared logger's global `enabled` state.
- Preserve quiet production defaults, structured JSON, minimal request/response
  fields, bounded request IDs and development-only pretty transport.
- Prove behavior through captured emitted output, not only an options-object
  assertion: HTTP access logs off must not suppress a deliberate application
  error or a sanitized HTTP exception log. Avoid duplicate exception logging.
- Keep request/response bodies, credentials and payment commands out of logs.
  Preserve redaction; coordinate token-path/exception sanitization with 03 before
  rollout. Never temporarily solve visibility by enabling SQL parameter logging.
- Expected outcomes: with access logging off, routine requests are quiet but
  explicit application errors remain; with it on, minimal sanitized access
  records appear; configured severity filters still apply.

### C. Minimal health contracts

Retain `GET /` and its exact 200 response for backward compatibility. Add distinct
public, non-tenant health endpoints in a focused backend service/controller:

| Endpoint            | Success                   | Failure                             | Meaning                                                                            |
| ------------------- | ------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /health/live`  | 200 `{ status: 'ok' }`    | No response if process cannot serve | HTTP process is running; no DB dependency                                          |
| `GET /health/ready` | 200 `{ status: 'ready' }` | 503 `{ status: 'unavailable' }`     | Initialized process can perform the bounded read-only DB probe and is not draining |

- Readiness reuses the application Prisma client and a static read-only probe,
  such as `SELECT 1`. No tenant/user/sale tables, client SQL or object IDs are read.
- Return only generic status; no connection settings, SQL, stack traces, migration
  names or tenant data. Prevent caching of health responses.
- Bound connection acquisition, execution and concurrent probes. Select the actual
  deadline/cancellation mechanism against the installed adapter; use single-flight
  work where appropriate. A timeout must not create unbounded orphaned probes or
  a pool per request. Do not change global business-query budgets just for health.
- Define testable draining behavior using the existing shutdown lifecycle: stop
  reporting ready when termination begins, finish/stop serving according to the
  framework lifecycle, then disconnect. Do not invent background-worker draining.
- Keep health polling separate from authenticated-user throttling; define the
  smallest host-compatible bound/exemption and test it. Trust-proxy identity is
  still owned by 03; no client-supplied tenant/role can affect these endpoints.
- Database unavailability after startup must produce 503, while liveness can stay 200. Do not map dependency failure to 401 or restart a healthy process solely
  because the database is temporarily unavailable.

`SELECT 1` is not schema certification. Plan 04 defines compatible migration
state; Plan 06 must enforce that gate before marking a release eligible for
traffic and run an authorized schema-dependent smoke read. A pending/failed or
wrong-baseline migration fails deployment even if live DB connectivity succeeds.
Do not claim readiness proves financial invariants or scan migration history on
every public health request.

## 4. Layers, authorization and compatibility

- Backend: package startup, logger configuration/tests, health service/controller,
  module wiring and explicit Swagger 200/503 contracts. Keep business controllers
  and guards unchanged; no generic infrastructure abstraction is needed.
- Frontend: no changes. It must not poll health to bypass normal session/API errors.
- Database: no entities, migrations or writes. Probe through runtime credentials;
  direct migration/admin credentials are not required for health.
- Health routes intentionally have no organization context and expose no business
  objects. All existing authenticated tenant routes retain their access checks.
- Preserve `GET /`, existing configuration names and current request-validation
  behavior. Update logging tests that encoded the global-disable mistake without
  weakening checks for quiet access logs and redaction.

## 5. Implementation phases and dependencies

1. Reproduce source/artifact mismatch and capture the worktree baseline. Complete
   Plan 01 prerequisite regression repairs or record unrelated failing gates.
2. Fix/test the start command against a fresh build. Do not boot the real API with
   ambient `.env` credentials; construct an isolated test configuration first.
3. Separate logging controls and verify captured production-mode output with access
   logging both off/on. Review privacy implications with 03; block release on leaks.
4. Add health contracts and mocked success/failure/timeout/draining tests. Validate
   probe cancellation/concurrency against installed adapter capabilities.
5. With an independently verified disposable DB under 04 safeguards, run a fresh
   built-process smoke: configured port, root/live/ready, DB loss/recovery and
   termination. No seed/reset or migration is implicitly authorized by this plan.
6. Run final gates, inspect the diff and update runtime documentation. Plan 05 sets
   deployment topology/budgets; 06 consumes these start/health contracts and the
   separate schema gate. Plan 10 configures monitoring rather than duplicating them.

Local mocked work does not require a hosting provider. Actual deadline and probe
frequency must fit the chosen host's timeout, pool and cold-wake limits. Resolve
those in 05/06 before deployment; missing host decisions do not justify arbitrary
global timeout changes or automatic restart loops.

## 6. Verification and acceptance

From `backend/`, using installed tools:

```sh
npm test -- --runInBand src/config/env.validation.spec.ts src/config/logging.spec.ts src/app.controller.spec.ts
npm run test:e2e -- --runInBand test/app.e2e-spec.ts
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx tsc --noEmit --incremental false
npm run lint
npm run build
npm run prisma:validate
```

Add new focused health/log-output test paths to these gates during implementation.
Run installed Prettier on changed files and `git diff --check`; do not format
unrelated work. No new dependency/lockfile changes without approval.

Required cases:

- Fresh artifact exists and `npm run start:prod` boots the build on an isolated
  approved target; invalid config fails without leaking secrets.
- Production access-logging false/true and severity filtering match §3, verified
  in emitted output. Startup and sanitized request exceptions are observable.
- Root compatibility; health success, connection/query failure, deadline expiry,
  repeated/concurrent probes, no-cache headers and sanitized 503 contract.
- DB down after successful boot: live stays responsive, ready fails and later
  recovers without business writes or a second client/pool.
- Termination disables readiness and closes resources; signals do not hang the
  process or silently abandon a successful financial command. Coordinate any
  discovered transaction shutdown risk with 10/18 rather than broadening scope.
- Unauthenticated health cannot expose tenant data or trigger unbounded work.
  Existing auth, role, organization/branch and DTO regression suites stay intact.
- Deployment simulation rejects incompatible migration state even when `SELECT 1`
  works; 04/06 own the actual schema compatibility implementation/evidence.

Record command, date, revision/worktree, environment and result. If process/DB
proof cannot run, label it unverified and keep the corresponding release gate
open; passing unit tests is not completion of operational qualification.

## 7. Documentation, rollback and remaining decisions

After implementation, add a focused `docs/modules/runtime-operations.md` reference
and link it from the docs index; describe implemented health/start/logging behavior,
configuration and evidence limits. Put release/operator instructions in the existing
development docs as appropriate. Do not rewrite feature module delivery histories.

Rollback affects only the approved application/configuration changes, no schema
or data. Prefer rolling back a known build with a working command and safe logging,
not reverting to the broken start path. Coordinate host probe changes with 05/06;
a removed readiness path must not strand otherwise healthy instances. Preserve
unrelated dirty-worktree changes and retain old verification evidence separately.

No new business decision is needed to draft this plan. Before deployment, resolve
the host-specific readiness deadline, polling/rate policy, shutdown grace period
and schema compatibility gate ownership with 04–06. These are explicit design/
operational gates, not permission to assume a provider, expose diagnostics or
add infrastructure. A security review is required for changed logging disclosure
and health-endpoint abuse boundaries before release.
