# Plan 12 qualification record

Date: October 27, 2026

Candidate: application code at `7caf584` (`main`); qualification record committed
as `9f7bac6`

Status: Qualification in progress. Disposable local correctness/query evidence
and current deployed browser/proxy checks passed. Release qualification remains
blocked by unresolved dependency advisories and unmeasured multi-user HTTP
capacity/security evidence.

## Scope and safeguards

- Node `20.19.4`, matching `.node-version` and CI.
- PostgreSQL `17-alpine` disposable containers bound to localhost-only ports.
- Performance suites used their random-schema setup and dropped the schema after
  completion. No application or deployed database was used for synthetic writes.
- No package versions, production configuration, payment records, recipients or
  infrastructure were changed.
- The user-approved pilot device qualification remains deferred and is not
  treated as a failure in this record.

## Passed disposable performance and correctness evidence

### Inventory and POS

The opt-in `inventory-pos-performance.integration-spec` passed: 1 suite and 1
test. The fixture contained 5,000 product placements and 10,000 movements.
Five warm service calls were measured after a warm-up:

| Operation | Median ms | Queries/call |
| --- | ---: | ---: |
| Inventory directory page | 9.63 | 6 |
| Inventory next page | 6.28 | 7 |
| Low-stock page | 7.79 | 6 |
| Inventory summary | 7.84 | 5 |
| Movement history | 3.87 | 7 |
| POS search | 9.22 | 5 |
| POS exact code | 1.85 | 5 |
| Eligible product picker | 7.93 | 2 |

Representative PostgreSQL plans completed within the disposable fixture at
approximately 2.729 ms for the directory page, 1.723 ms for low-stock, 0.821 ms
for summary, 0.037 ms for the bounded movement page, 2.215 ms for POS search,
0.363 ms for exact code and 2.012 ms for the eligible-product picker. These are
local measurements, not hosted p95 guarantees.

### Sales Reports

The Reports integration qualification passed: 51 tests. Its fixture contained
10,001 sales and 2,001 refunds. The maximum supported yearly report measured
119 ms and 1,370,648 serialized bytes; the slowest logged query was 40.348 ms,
with 40 raw queries. Exact totals, branch/all-branch scope, merchant privacy,
refund-only periods, negative periods, pagination and concurrent snapshots all
passed.

### Refund history and commands

The refund-command integration qualification passed: 44 tests. Its history
fixture contained 1,500 refunds. Unfiltered and filtered reads measured 3.143 ms
and 3.181 ms, with a 6,033-byte payload. The representative indexed page plan
completed in 0.029 ms. Tenant/branch/role isolation, partial and full returns,
actual refund accounts, rollback, idempotent replay and concurrent refund/stock
effects all passed.

## Passed local security evidence

- Authentication account throttling: 1 suite, 1 test.
- Focused HTTP security matrix: 4 e2e suites, 255 tests covering sessions,
  Reports, Products/Inventory and Refunds.
- Existing full Node 20 backend gates remain green: 51 unit suites/622 tests and
  9 e2e suites/282 tests.
- The focused coverage exercised session binding/revocation, role boundaries,
  guessed organization/branch/resource IDs, merchant own-only projections,
  foreign-tenant rejection and stale membership checks.
- Existing production configuration keeps Express `trust proxy` disabled and
  does not use Next image/OG routes. These reduce the reachable surface of some
  audited transitive packages but do not remove the need to disposition them.

## Passed hosted probes

Configured deployment origins:

- API: `https://concept-store.onrender.com`
- Frontend: `https://kapwesto.vercel.app`

The read-only operations check passed all four probes: API liveness, API
readiness, frontend reachability and the frontend same-origin API proxy.

Observed API headers included HSTS, CSP, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, no-store health
caching and the configured credentialed origin.

- A request with the configured frontend Origin returned the configured
  `Access-Control-Allow-Origin`.
- A request with `https://evil.example` did not echo that origin; it returned
  only the configured origin, which browsers reject for the evil caller.
- An evil-origin preflight likewise returned the configured origin rather than
  granting the requesting origin.
- `/api/docs` returned HTTP 404, so the deployed Swagger route was not exposed.

These probes establish deployed reachability and current middleware behavior;
they do not prove authenticated two-organization access or CSRF resistance for
state-changing commands.

### Authenticated hosted route probe

Using the documented seeded accounts and the configured API origin, Owner,
Manager, Cashier and Merchant login responses were HTTP 200. Each account also
reached `/auth/me` and `/organizations` successfully. The current Reports route
`/organizations/{organizationId}/reports/sales/all` returned HTTP 404 for the
Owner probe, and the same missing-route response was observed for the other
roles. This is inconsistent with the current source and frontend API contract
and indicates that the deployed API is stale, pointed at the wrong service/build,
or otherwise missing the Organizations Reports module. A repeated probe was
stopped after the login throttle returned HTTP 429; no rate-limit bypass was
attempted. No hosted writes were made.

### Current redeployment browser verification

After Render redeployed commit `044f257`, Chrome verified the current hosted
release without changing data:

- Owner sign-in succeeded and the organization workspace loaded.
- Reports loaded through the Vercel same-origin `/api` path.
- The Reports branch selector exposed `All branches`, `BGC Satellite (BGC)` and
  `Makati Main (MAKATI)`.
- The All branches Overview rendered the payment-account flow section with the
  configured accounts and all four report tabs: Overview, Transactions, Daily
  Data and Rankings.
- Transactions, Daily Data and Rankings each rendered their table/empty state
  and `1/1` pagination state for the seeded date.
- Switching to `BGC Satellite (BGC)` navigated to the branch-scoped Rankings
  route and completed its loading state.

This supersedes the earlier stale-deployment 404 observation for the current
deployment. It does not replace two-organization authorization, five-user
capacity, dependency disposition or state-changing CSRF/Origin evidence.

## Dependency audit findings

`npm audit --omit=dev --audit-level=high` reached the advisory service and
returned non-zero findings:

| Workspace | Runtime findings | Important paths/advisories |
| --- | ---: | --- |
| Backend | 13: 1 critical, 9 high, 3 moderate | `proxy-addr`, `body-parser`, `fast-uri`, `multer`, `mysql2`, `zod`, `deepmerge-ts` via Prisma, `js-yaml`, `qs` |
| Frontend | 4: 1 critical, 3 high | `next` 16.3.2, `sharp`, `source-map-js`, `zod` |

The backend critical `proxy-addr` finding is partly mitigated by the verified
`trust proxy=false` configuration, but remains a dependency risk. The frontend
critical Next advisories affect the locked `16.3.2` range; npm reports a fix at
`16.4.3`. No `npm audit fix`, forced upgrade, lockfile change or production
redeploy was performed because Plan 12 does not authorize package changes by
itself. These findings require an approved bounded dependency-update slice,
compatibility proof and redeployment before release sign-off.

## Remaining qualification gates

- No bounded five-user mixed workload across two organizations has been run.
- No p50/p95/p99, throughput, error-rate, cold-start, soak, CPU/memory,
  connection-pool wait or multi-instance pool evidence exists.
- Inventory, Reports and refund measurements are service/integration paths, not
  authenticated requests through the deployed Next `/api` path.
- The earlier authenticated Reports 404 was resolved by redeploying the current
  Render build and is now superseded by the browser verification above.
- Deployed authenticated two-organization/branch smoke, cookie refresh/logout,
  and state-changing cross-origin/CSRF probes remain open. SameSite and exact
  CORS behavior are not a substitute for an explicit CSRF/Origin decision.
- A dependency disposition and approved update path are required for the
  critical/high runtime advisories.
- Pilot device/browser qualification remains deferred per user instruction.

## Ownership and next action

Dependency remediation belongs in a bounded update/release slice with Plan 06
CI and Plan 14 sign-off. Proxy/cookie/CSRF topology changes belong to Plan 05;
auth behavior changes belong to Plan 03. Plan 12 should consume their evidence
and rerun the security/capacity gates rather than silently changing those
contracts.

Until those findings have an approved disposition, Plan 12 is not complete and
the system is not qualified for public paid-SaaS release.
