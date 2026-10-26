# Plan 12: Performance, dependency and security qualification

Date: October 24, 2026

Status: Closed October 27, 2026 at the user's direction with explicit deferral
of all remaining qualification gates. Passed evidence is retained; this is not
public paid-SaaS qualification. No package update or production change was
authorized by this plan alone.

Priority: P0 for security/data-integrity failures and essential pilot capacity;
larger-scale qualification is P1 before expanding beyond the tested envelope.

## 1. Goal and confirmed scope

Qualify the exact release and hosting configuration for bounded pilot use, not
unlimited SaaS scale. Own dependency review, realistic capacity/query measurement
and security qualification in the
[deployment checklist](../../deployment-readiness-checklist.md), §6–7.

Confirmed October 24: pilot capacity is up to five simultaneous staff across
1–2 organizations. This is an initial workload target, not five total accounts,
five requests per second or permission to omit Merchant/Owner scenarios. Confirm
representative catalog/history sizes before the executable test profile is final.

Reuse existing Jest/PostgreSQL tests, Node timing, npm lockfiles and host/DB metrics.
No Redis, queues, extra datastore, generic benchmark framework, autoscaling or new
scanner/load package by default. Do not perform intrusive production tests or
upgrade dependencies as a side effect of an audit. New tooling/spend requires
approval. Functional fixes go to the smallest responsible approved scope.

01 owns baseline repair; 03 authentication/request protection; 04 DB/pool/restore;
05 host topology; 06 enforced checks; 07 onboarding/operator/mail; 08 account money;
09 scope aggregation; 10 operational monitoring; 11 browser workflows; 14 release
decision; 16–18 lifecycle/pagination/recovery. This plan verifies their integration,
not reimplements features or certifies legal compliance.

## 2. Repository evidence and gaps

Reviewed package/lockfile locations, performance harness, rate-limit config,
PrismaService/environment limits, bootstrap/Throttler wiring and checklist.

- `backend/test/inventory-pos-performance.integration-spec.ts` is explicitly
  opt-in via `RUN_PERF_BENCHMARK=1`, uses `TEST_DATABASE_URL`, isolated schema,
  synthetic fixtures (5,000 products/10,000 movement inserts), Node timing and
  query counts. Its adapter pool maximum is 20, not proof of host configuration.
- Existing benchmark notes under `docs/development/` are historical baselines,
  not the current release's performance guarantee. A skipped opt-in suite is not
  a passing measurement; inspect actual output and harness assertions.
- Runtime PrismaPg has configured pool maximum, connect/idle/query timeouts and
  optional SQL/parameter logging. Test with the intended deployed settings, not
  only local defaults. Parameter logging is inappropriate for private live data.
- Global Throttler and dedicated auth/invitation limits exist. Current config
  alone does not prove proxy identity, independent users or multi-instance limits;
  03/05 own those contracts. A global 300/minute limit is not a capacity metric.
- Nest uses Helmet/CORS, but headers alone do not prove authorization or CSRF
  safety. No fresh dependency audit, full security review, benchmark, network test,
  hosted measurement or database check ran for this documentation draft.

## 3. Test target and reproducibility

Before running anything, resolve exact disposable DB/schema, URL host and owning
account; require 04 safeguards and refuse ambient live URLs. Use synthetic data
only, distinct tenant identities and restricted test credentials. Hosted testing
requires explicit target/traffic permission, provider terms/quota review and
spending approval if applicable. Never load-test unrelated/shared public services.

Record release SHA, lockfile hashes, Node/npm versions, schema/migrations,
machine/region/provider sizes, proxy route, pool/timeouts, test seed, dataset,
actors, request mix, warm/cold state and timing methodology. Bound duration,
concurrency, generated data and teardown. Stop on data-integrity error, sustained
resource exhaustion, unexpected real data/recipient, runaway cost or wrong target.

Do not run synthetic writes through live payment or email recipients. Controlled
mail doubles exercise request paths; actual delivery checks belong to 07/11.
Do not publish secrets/private payloads in benchmark results or query plans.

## 4. Capacity and query qualification

Create a small reproducible workload with realistic think time and five independent
authenticated staff, including assigned branches and two tenants. Include:

- Cashier catalog search, exact-code lookup, Load more, cart review and checkout.
- Manager stock/movement browsing and updates alongside cashier use.
- Owner/Manager All Branches summaries, transaction/daily/ranking pages, All Time
  and long ranges; dynamic shared/disabled/historical account totals.
- Merchant own-only history to catch both performance and projection regressions.
- Separate explicitly bounded bursts and cold-start/dependency-wake runs; label
  them separately from steady-state results. Shared-NAT users must not be mistaken
  for one abusive client; measure 03's intended rate identity without bypassing it.

Fixture tiers: existing benchmark as a reuse baseline, plus intended pilot counts
of branches/products/accounts/merchants and sale/refund history. Get estimates
from pilot stores before freezing acceptance. Include >15 rows, late pages,
long search/reference text, cross-branch products, refund-only periods and negative
net. Do not present an arbitrary large fixture as actual customer usage.

Measure end-to-end HTTP through the deployed Next `/api` path separately from
service/SQL timings: p50/p95/p99, throughput, error/timeout rates, response size,
query count, CPU/memory/restarts, connection/pool wait and DB/provider quotas.
Use sufficient samples and repeat runs; report sample count and variance, not
single-call thresholds or misleading percentiles from tiny samples.

Proposed pilot engineering budgets, to approve after baseline (not a paid SLA):

| Path                                             | Warm-load target proposal                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Product lookup/search and normal paginated reads | p95 ≤1 second end-to-end at five staff                                               |
| Checkout/refund command response                 | p95 ≤2 seconds, excluding deliberate user input/provider money transfer              |
| All Branches report request                      | p95 ≤3 seconds for agreed pilot dataset/ranges                                       |
| Integrity and request outcome                    | Zero duplicate money/stock effects, authorization leaks or unexplained lost outcomes |

Report cold starts separately and qualify usability/recovery under 05/10; do not
hide them to claim the service meets warm targets. Agree a bounded soak duration
and operational timeout budget before execution. Intentional validation/conflict/
rate-limit responses are classified, not silently discarded or counted as success.

For slow paths use scoped query count and `EXPLAIN` on synthetic data; any
`EXPLAIN ANALYZE` executes the statement and needs the same target/write safeguards.
Check missing predicates/indexes, N+1 queries, full scans, join multiplication,
unstable pagination and wide selects before proposing infrastructure. Large ID
lists and per-branch queries are not an All Branches strategy. Add an index only
with measured benefit, write-cost assessment and approved 04 migration. 17 owns
required pagination/continuation, not speculative caching introduced here.

## 5. Financial concurrency and failure proof

Run service/HTTP and actual PostgreSQL concurrency tests independently of latency
benchmarks. Saturation is not permission to weaken transactional invariants:

- Same checkout/refund command submitted concurrently: at most one source record
  and stock effect; repeated saved outcome stays stable and freshly authorized.
- Different commands competing for last stock or remaining return quantity: no
  oversell, over-return or double restock. Expected conflicts are visible/recoverable.
- Account disable/reassignment/reference edit, branch/tenant deactivation and grant
  removal racing a completion follow 07/08/16/18's explicit ordering and replay rules.
- Response loss after commit, dropped connection, transaction timeout, process
  restart/reload and multiple tabs preserve 18's unknown-outcome safety. No blanket
  auto-retry, new request ID or second physical collection/payout.
- Report sums remain exact under numeric aggregation, partial refunds and shared
  accounts; pages/counts/totals share one request snapshot. Different report calls
  may legitimately observe newer commits.
- Restored snapshots can lose idempotency records: consume 04/10/18's quarantine/
  investigation procedure rather than treating absent outcomes as safe retries.

Coordinate pool budgets across all running app instances, release overlap, jobs,
health probes, migrations and test clients with available DB connections. One
instance's pool maximum is not the platform total. Verify query cancellation,
bounded failure/cleanup and no accumulated orphan work. Do not simulate actual
DB corruption or production recovery here; use isolated fault injection only.

## 6. Dependency and application security review

Inventory exact locked runtime and development dependency versions in both apps,
supported runtime requirements and exposed deployment components. During approved
qualification run npm's available audit tooling against each lockfile and review
current primary advisories for affected packages. Network/advisory-service failure
means unknown, not clean. Never claim vulnerability absence from this draft.

Triage by exploitability, deployed reachability, privilege and fix availability,
including build/dev supply-chain exposure. Record advisory/version/path, impact,
decision, owner, expiry and retest. Block unresolved exploitable critical/high
risks to tenant/auth/payment data; exceptions need explicit evidence and approval,
not blanket acceptance because an advisory is transitive. Review other severities
on impact. No automatic `npm audit fix`, forced major updates or lockfile churn.
Apply approved upgrades in a bounded plan with compatibility/regression proof.

Review and exercise these contracts:

- Session-bound JWT immediate revocation, password byte policy, action-token use,
  registration anti-enumeration, verified access and operator command boundaries.
- Direct and guessed tenant/branch/merchant/account/source IDs, altered roles,
  current membership rechecks and Merchant field-level redaction on real responses.
- Strict DTO unknown-field rejection, lengths/page/range/body bounds, numeric
  precision, malformed commands, hostile search strings and unsafe redirect targets.
- Same-origin proxy fixed upstream, cookie path/clear/Secure behavior, exact origin/
  CSRF policy, trusted forwarding headers and independent rate identities. Include
  direct Nest access; no trust merely because a request claims it came via proxy.
- Token/credential/log/SQL-parameter leakage, Swagger exposure, production stack
  disclosure, mail links and build artifacts/public environment variables.
- No cross-user/tenant auth/report caching or old response restoring data after
  scope/access changes; no frontend hidden-control-only permissions.

Use synthetic local/staging probes and code/contract review first. No broad public
penetration scan, brute force or denial-of-service testing. Independent deep review
of security/financial/migration/concurrency implementations is required before
sign-off; a checklist or package audit alone is not that review.

## 7. Delivery phases, verification and response to failures

1. Confirm target profile, fixture volumes, budgets and bounded approved execution
   environment. Capture baseline without changing production or package versions.
2. Reuse/extend existing test harness minimally; make skipped opt-in tests visibly
   unqualified. 06 runs deterministic checks; resource-sensitive benchmarking may
   be a separate controlled gate rather than flaky shared-runner wall-clock tests.
3. Run locked dependency review and code/API security matrix. Route findings to
   responsible plans; obtain approval for new packages/upgrades or scope expansion.
4. Execute five-user mixed load, repeat/soak/cold-start profiles and disposable
   financial concurrency/fault tests. Compare to measured budgets and exact fixture
   outcomes; no broad tolerance for money or authorization failures.
5. Fix scoped defects, retest affected suites and compare before/after queries.
   Run formatting/lint, app/test-source typechecks, Prisma checks when applicable,
   unit/HTTP/disposable-integration suites and both production builds. Preserve
   unrelated work and do not hide failed tests with skips/exclusions.
6. Publish dated sanitized evidence under `docs/development/` or a dedicated
   qualification directory, linked to 06/10/11/14. Record limitations and capacity
   upgrade triggers. Update implemented module docs only for actual shipped changes.

If capacity fails, reduce approved pilot workload or upgrade with user approval;
do not silently lower quality or disable security. Stop onboarding beyond the
tested envelope and retest after meaningful host/schema/query/runtime changes.
Performance fixes must not broaden scopes, corrupt totals or weaken replay rules.
Rollback only compatible app/config changes under 04/06; never reset history.

## 8. Open gates and completion

Confirmed: five simultaneous pilot staff, 1–2 organizations. Still agree actual
catalog/history volumes, request mix, warm/cold/soak budgets, host/region/quota,
test windows and available review resources. Engineering latency numbers above
are proposals, not user-approved contractual guarantees.

Complete when the exact candidate passes required security/integrity gates and
agreed five-user capacity, all relevant dependency findings have dispositions,
critical risks are resolved and evidence/limits are explicit. 14 owns real pilot
and paid-launch approval. Passing local tests does not certify hosted capacity,
restore targets, legal compliance or unlimited scale.

### User-directed deferral

On October 27, 2026, the user instructed that all remaining Plan 12 tests and
gates be skipped for now. The following remain unqualified and are not treated
as passed: five-user mixed HTTP capacity, p50/p95/p99 and resource evidence,
two-organization hosted authorization, refresh/logout and state-changing
CSRF/Origin probes, and dependency-advisory remediation/disposition.

The plan is therefore closed administratively and archived as deferred, not
qualified. Plan 14 must retain these items as explicit release risks if a pilot
or paid launch is considered before they are rerun.
