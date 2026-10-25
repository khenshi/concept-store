# Plan 06: CI and repeatable release pipeline

Date: October 24, 2026

Status: Approved for staged implementation October 25, 2026. The repository
workflow and local verification commands are authorized; branch protection,
credentials, database operations outside explicitly disposable targets and
deployment changes remain unauthorized.

Priority: P0 before real pilot transactions. Basic CI can be implemented before
hosting is selected; hosted release automation waits for approved provider details.

## Implementation progress — October 25

Added a pinned GitHub Actions verification workflow with separate frontend,
backend and built-runtime/proxy jobs plus a stable `Required checks` aggregate.
It uses Node `20.19.4`, synthetic credentials, PostgreSQL 17 service containers,
explicit disposable test URLs, no demo seed, no live secrets, no deployment and
no migration against an application database. Backend now has named full
test-source `typecheck` and CI runtime-smoke scripts. The frontend launcher
resolves its local Next binary so direct CI invocation honors the assigned port.

Local proof passed: frontend format check, 1,195 tests, lint with four existing
Inventory warnings, typecheck and build; backend format/lint/typecheck/build,
604 unit tests and 274 HTTP tests; built Nest readiness; and built Next
`/api/health/live` proxy smoke against the disposable PostgreSQL service.

The explicit PostgreSQL integration run is now green: 315 tests passed and one
was skipped. Four stale pagination/migration fixtures were repaired without
changing the current production contracts or migration behavior. Branch
protection settings, runner enforcement, hosted release, migration approval and
provider credentials remain unverified/open. This plan is staged, not complete.

## 1. Goal, ownership and exclusions

Make each release reproducible, tested and explicitly approved. Own the enforced
CI, pinned toolchain, release identity, migration ordering and rollback gates in
the [deployment checklist](../../deployment-readiness-checklist.md), §6.

Reuse existing npm scripts, lockfiles and test suites. No new application entity,
API, UI, financial logic, CI framework, container platform or dependency is needed
by default. Do not introduce automatic live deployment, paid runners, demo data,
coverage targets chosen without a baseline or a second migration procedure.

Dependencies: 01 repairs baseline failures; 02 owns executable runtime/readiness;
03 security controls; 04 database safety and migration/restore procedure; 05 the
confirmed same-origin `/api` topology and eventual host selection. Plans 10–14
own monitoring, browser/workflow/load/policy qualification and launch approval.
18 owns durable financial-command recovery. A green build replaces none of these.

## 2. Source evidence and gaps

Inspected October 24:

- No `.github` directory exists in this checkout. Provider-side pipelines and
  repository protection settings are unverified, not assumed absent.
- Separate `backend/package-lock.json` and `frontend/package-lock.json` exist;
  each application has its own scripts, not a root npm workspace pipeline.
- Backend has format/lint, unit Jest, HTTP `test:e2e`, serial PostgreSQL
  `test:integration`, Prisma validation/generation and Nest build commands.
  Its `postinstall` generates Prisma. CLI config requires
  `DIRECT_DATABASE_URL`; generation/install environment must be explicit.
- Backend build excludes tests and `prisma.config.ts`. A successful build is
  not test-source typecheck evidence. There is no named backend typecheck script.
- Frontend has format/lint/typecheck, Vitest and webpack production build scripts.
  It has no browser E2E script. HTTP test naming does not prove actual browser use.
- `backend/test/reports.integration-spec.ts` requires `TEST_DATABASE_URL`, creates
  a random schema and applies migration SQL. Schema isolation alone does not make
  an arbitrary target safe. Other harnesses must pass 04's shared safety review.
- Backend production command still points at `dist/main.js`; 02 owns correction
  against a clean built artifact. Frontend production start fixes port 3001; 05
  owns host-port behavior. Do not encode known-broken commands in deployment.
- Known failures in 01 are dated evidence, not permanent exemptions. No full
  application suite, clean install/build, CI execution or hosted check ran for
  this documentation draft. No target database was contacted.

## 3. Proposed CI gates

Start with a small repository-native workflow, preferably GitHub Actions if the
repository is hosted there and the user approves its runner/usage terms. Verify
the actual repository settings before implementation; this is not a provider
purchase. Pin supported Node and npm versions after testing the locked dependency
requirements. Record them once and reuse locally, in CI and on the selected host;
do not infer the runtime from `@types/node` or opportunistically upgrade packages.

| Gate           | Required behavior                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Install        | `npm ci` separately in backend/frontend; lockfiles authoritative, no lockfile rewrites or unpinned global CLIs. Provide only synthetic configuration needed for install/generation.                                                                    |
| Backend static | `npm run format:check`, `npm run lint`, Prisma validate/generate, and `tsc --noEmit` covering application, tests and Prisma config. Add a narrow named typecheck/config only if existing compilation needs it; never hide test errors with exclusions. |
| Backend tests  | `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, then `npm run test:integration` with a verified ephemeral PostgreSQL service and explicit test URL.                                                                                      |
| Frontend       | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` with nonsecret validated build configuration.                                                                                                                 |
| Build/runtime  | Backend clean build, inspect expected output and run 02's built-process smoke against the disposable database; frontend built-process smoke uses 05's port/proxy contract. No developer leftover `dist` or `.next` artifacts.                          |
| Result         | Stable required aggregate check fails on failures, cancellation, timeout, skipped mandatory jobs or missing evidence. No `continue-on-error` release bypass.                                                                                           |

Use existing installed binaries via npm scripts or local paths, not network-fetched
latest tools. Initial correctness-first workflow runs both apps for code changes;
path-based optimization is later and must account for schema, contracts, lockfiles
and shared configuration. Documentation-only checks may be lighter without making
required checks disappear. Application builds must not run migrations or seeds.

Practical controls:

- Cache package downloads keyed by platform/toolchain/lockfile, not databases,
  secrets, test outcomes or stale generated build outputs. Cap job duration and
  parallelism; run integration suites serially as already configured.
- Use a pinned PostgreSQL major/version consistent with 04/05. Test credentials
  exist only for that run. Require explicit target checks before schema creation,
  migration, truncation or cleanup; never fall back to an ambient application URL.
- Review the complete integration harness before enabling it. Exercise migration
  deployment on a fresh disposable database as well as its raw-SQL suite setup;
  one does not prove the other. Add a supported previous-schema upgrade rehearsal
  when a release changes schema, using only synthetic fixtures.
- Preserve authorization, cross-tenant/branch denial, money precision, checkout/
  refund idempotency, concurrency and historical-account attribution tests as
  applicable. Wire new regression suites as their owning features land.
- Dependency audit output feeds 12's severity/exception review; never auto-run
  audit fixes or treat an unchecked advisory report as security qualification.

## 4. Workflow and credential security

Run pull-request verification without deployment or live-database secrets. Never
execute untrusted PR code in a privileged deployment context, including fork or
dependency-update changes. Use least-privilege workflow tokens; review and pin
third-party actions to immutable revisions with a deliberate update process.
Do not expose secrets through logs, environment dumps, shell tracing, caches,
artifact uploads or frontend public variables. Synthetic test credentials are
not reusable operator accounts. Tenant fixtures must not contain customer data.

Require the agreed aggregate checks on the release branch and restrict bypass
authority. Verify settings and demonstrate a failing check blocks release; a YAML
file alone does not enforce policy. Repository-plan support for protections and
approval environments is unverified. If unavailable, retain a documented manual
operator approval gate and explicitly record weaker enforcement for 14's decision;
do not claim equivalent automated protection or incur spending silently.

Cancel obsolete verification runs if useful. Serialize releases per environment;
do not cancel an in-progress live migration because a newer commit arrived.
Never run overlapping schema migrations. Default to read-only permissions and
separate test, staging, migration and runtime credentials per 04.

## 5. Controlled release sequence

1. Select an immutable reviewed commit, with all mandatory checks passed for that
   exact SHA. Record release ID, toolchain/lockfile hashes, configuration version,
   migration names/checksums, evidence links and named approver. No secrets in record.
2. Build both applications from that SHA. Prefer promoting verified artifacts when
   the host supports it; otherwise rebuild the same locked source/config and
   record provenance. Next public values are build-time inputs: a different origin
   requires a verified environment-specific build, not blind artifact reuse.
3. Rehearse on isolated staging using 04's migration protocol and 05's `/api`,
   cookie, CSRF, trusted-ingress and port contracts. Complete built-runtime and
   browser checks before live promotion. Staging mail must not reach real users.
4. Obtain explicit operator approval for the target environment. Verify identity,
   backup/restore readiness, migration provenance, app/schema compatibility and
   rollback path. Stop for drift, failed migrations, unknown history, missing
   credentials or absent prerequisite evidence. Never use demo seed/reset.
5. Run 04's approved migration once through a controlled release step before the
   dependent app version. Keep old and new application versions compatible during
   overlap. If an incompatible change cannot be made additive, stop and approve a
   maintenance/cutover procedure rather than inventing zero-downtime guarantees.
6. Deploy compatible API, then frontend as defined by the release compatibility
   matrix. Disable independent auto-deploy paths that could race this sequence.
   A frontend-only or API-only release may skip the other deployment only with
   explicit contract compatibility evidence.
7. Check process liveness, bounded DB readiness AND expected schema/migration
   compatibility separately. Exercise authorized scoped reads, unauthenticated
   denials, refresh/logout and public proxy behavior. Do not create real sales or
   refunds as a routine smoke test; financial flows belong in synthetic staging
   unless a separately approved controlled live procedure exists.
8. Observe errors/latency/financial unknown outcomes through 10; approve or halt
   rollout. Simple sequential promotion is enough for MVP. No canary platform is
   required; any small canary must not weaken database or command consistency.

Production migrations remain operator-approved even if verification is automatic.
The pipeline must not grant organization Owners platform deployment authority.
No changes to application RBAC, organization/branch scopes or data ownership.

## 6. Failure handling and rollback

Fail closed if a mandatory job never ran or the deployed SHA differs from the
approved candidate. Keep sanitized diagnostics with bounded retention agreed with
13; retain failed check evidence without saving tokens or private transactions.

On migration failure, stop app rollout and follow 04's target-specific procedure;
do not blindly retry, mark migrations resolved or run down-migrations. On app
failure, restore a compatible prior build/config only if it still supports the
current schema and 03/05 cookie/session contracts. Prefer forward repair if not.
Do not restore an old DB over newly committed sales to roll back application code.
Recovery from genuine DB failure uses 04's proven ≤15-minute RPO / ≤2-hour RTO,
not an untested pipeline promise. Preserve 18's pending commands throughout.

## 7. Implementation phases and acceptance

1. **Baseline/toolchain:** finish relevant 01 fixes, record clean-install behavior,
   runtime support and exact commands; no test weakening or blanket suppressions.
2. **Verification CI:** add minimal workflow and optional narrow scripts; prove
   clean success, deliberate failure, missing test URL refusal, isolated teardown,
   and secrets absent from PR contexts. Fix/review failure-injection changes before
   merge; do not leave broken tests committed.
3. **Enforcement:** configure approved branch checks and permissions; prove a red
   candidate cannot release and independent provider deploys cannot bypass gates.
4. **Staged release:** after 02–05 contracts are implemented and host approved,
   wire migration/deployment approval and smoke checks. Rehearse failed migration,
   bad readiness, rejected artifact/SHA, serialized releases and compatible rollback.
5. **Sign-off:** record local CI, hosted smoke, browser, real-DB migration, restore
   and workload evidence separately. 14 owns launch approval after all required
   product plans, including 07–09 and 18, pass; drafting or enabling CI is not launch.

Application schema/API/frontend feature changes are not required by this plan.
Expected implementation surfaces: CI definition, minimal package scripts/runtime
pins, provider build/release manifests once selected, and operator documentation.
Update development verification instructions and create/update the runtime-operations
module documentation planned by 02 when the behavior actually exists. Record
host dashboard settings that cannot be versioned, owner and verification date.

## 8. Open decisions and risks

- Confirm repository host, runner quota/terms, branch-protection capabilities,
  release branch and named operator/approver before workflow implementation.
- Host is not selected; provider-specific deployment credentials, artifact handling,
  approval integration and prices remain blocked on 05 and user authorization.
- Retention, incident ownership and permissible verification minutes must be agreed;
  no paid compute or broad admin credential is implicitly approved.
- Browser automation is not installed. 11 decides the smallest adequate approach;
  require review before adding dependencies, and retain recorded manual browser
  acceptance until an approved automated gate replaces it.
- Existing baseline failures may make initial CI red. Repair via 01 and the owning
  feature plans; never normalize failure as an accepted release state.

No new business decision is needed to draft this plan. Resolve operational settings
at implementation rather than guessing account capabilities or purchasing services.
