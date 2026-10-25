# Plan 04: Database migration, isolation and recovery safety

Date: October 23, 2026

Status: Approved for staged implementation October 25, 2026. Local target
safeguards, migration rehearsal and synthetic restore evidence are recorded; no
application, pilot or production database was contacted. Recovery targets in §8
were confirmed October 24: at most 15 minutes of lost data and recovery within
2 hours. Provider-qualified implementation and measured proof remain pending.

Priority: P0 before storing real pilot data. Free testing with real organizations
still requires tested data protection, not assumptions about free hosting.

## 1. Goal, scope and ownership

Define target-verified migrations, safe credentials, isolated integration tests,
backups and restoration without breaking tenant isolation or financial history.
Owns the migration/data-durability/seed/pool gates in the
[deployment checklist](../../deployment-readiness-checklist.md). Reuse the
[seed guide](../../development/database-seeding.md) and
[integration harness](../../../backend/test/README.md).

Included: environment separation, provenance/drift checks, destructive-command
safeguards, least-privilege roles, backup/restore proof, pool/outage testing and
safe rollout/rollback procedures.

Excluded: feature schema design (03/07/08/17/18/20), provider provisioning (05),
CI wiring (06), monitoring (10), legal retention decisions (13), per-tenant DBs,
new infrastructure, a migration framework or automatic financial/data repair.
Past permission to reset development data is not permission to reset real data.

02 owns health/start contracts; 04 owns DB/schema safety; 05 selects hosting;
06 executes approved release gates; 10 operates recovery; 14 requires evidence.
Agree interfaces early without creating circular deployment prerequisites.

## Implementation progress — October 25

The local destructive demo-seed path now requires a loopback
`DEMO_DATABASE_URL`, exact database-name confirmation, an explicit reset
confirmation, the public schema, and current completed Prisma migration history.
It no longer falls back to `DATABASE_URL`/`DIRECT_DATABASE_URL` or accepts a
production override. Refusal behavior is covered by focused tests. A separate
read-only migration preflight compares explicit-target history names/checksums
with repository files and classifies empty, upgrade-needed, current and unsafe
states. A disposable PostgreSQL 17 rehearsal classified an empty target,
applied all 18 tracked migrations, and then classified the target as current;
evidence is recorded in [the dated validation note](../validation/database-safety-2026-10-25.md).
The same local validation restored a guarded synthetic fixture into a separate
target, preserved aggregate tenant/inventory/sale/refund counts, verified current
migration history and reconnected the production API with successful root,
liveness and readiness checks. It does not establish provider backup coverage,
two-organization privacy, least-privilege roles or the accepted RPO/RTO. The
provider-specific target selection, provider backup/restore qualification,
least-privilege roles, pool/outage qualification and deep review remain open.

## 2. Current evidence and architectural weaknesses

Inspected Prisma schema/config/migrations, `backend/prisma/seed.ts`, runtime
`PrismaService`, seed guide, test README and representative integration fixtures.

- Prisma CLI uses `DIRECT_DATABASE_URL` via `backend/prisma.config.ts`; runtime
  uses `DATABASE_URL` through PrismaPg. Both load configuration that could point
  at a wrong environment. Variable names/valid URLs do not establish safe targets.
- The seed guide warns the foundation migration baseline was rewritten. A database
  created under an older chain cannot be assumed compatible with current deploy.
- Demo seed truncates public-schema application tables with cascade, retains
  `_prisma_migrations`, creates known-password accounts and prints an invitation
  token. Its environment protection can be bypassed with `SEED_DEMO_DATA=1`.
- Integration suites use explicit `TEST_DATABASE_URL` and random schemas, apply
  migration SQL and perform cleanup. Schema isolation still requires a disposable
  DB, not a store DB. Raw-SQL fixtures do not prove Prisma deploy/history tracking.
- Runtime defaults are 10 pooled connections, 30s idle timeout, 10s connection
  timeout and 30s query timeout. Workflow transaction budgets vary; aggregate
  provider capacity and cold-wake behavior are not verified.
- Merchant-branch conversion requires coordinated writes-paused deployment.
  Space-type migration introduces a catalog FK/registration trigger. Occupancy
  timestamp-removal SQL exists, but actual target parity after the reported NOT
  NULL error is unverified. Inspect the whole chain, not just one missing column.
- No actual migration provenance, backup schedule, restore drill or accepted
  recovery target has been established by source review.

Fresh drafting check: installed `prisma validate` passed October 23. This proves
schema/config syntax only. No application database was contacted; no migration
status/diff, integration tests, backup or restore ran.

## 3. Environment isolation and destructive-command safety

Maintain separate dev, disposable-test, pilot and production databases/credentials.
Before an approved connection/write, verify host/provider project, database,
schema, environment and credential purpose against operator-owned configuration.
Redact credentials in evidence; never print environment files/full URLs. Pooled
and direct hostnames can differ, so verify their project/database mapping rather
than relying on URL string equality.

Harden the existing seed/test entry points at their responsible layers:

- Deny destructive demo work against live pilot/production. `NODE_ENV`, a reset
  flag, a name containing `test`, or one override variable is not sufficient proof.
- Require explicit disposable-target identification/confirmation and test refusal
  before connecting or running destructive SQL. Preserve useful local fixtures.
- Never fall back from `TEST_DATABASE_URL` to an ambient application URL.
- Constrain cleanup to the exact schema/container created by the test. Verify its
  identity before cleanup; document interrupted-run recovery, not broad wildcards.
- Never call demo seed/reset from build/postdeploy/release/health/onboarding.
  Plan 07 provisions real organizations without known demo passwords.
- Plan 08's later developmental reset still needs exact-target preflight and
  approval. Once real records exist, use compatible migrations, not reset.
  Do not erase migration history just to create fresh fixtures.

No destructive operation is authorized by this document. Any later script must
make the target and intended effect clear and preserve unrelated schemas/data.

## 4. Migration and compatibility workflow

### Read-only preflight after connection approval

Inspect repository migration names/checksums, target `_prisma_migrations`, failed/
unfinished records, unexpected migrations and actual schema objects. Include
foreign keys, checks, indexes, triggers, intended schema/search path and data
assumptions, especially tenant ownership/access joins and occupancy column state.

Classify each target:

| Target                                                                    | Required path                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Empty supported target                                                    | Rehearse the tracked migration chain                                         |
| Known compatible tracked target                                           | Rehearse outstanding migrations on a disposable restored copy                |
| Unknown/rewritten baseline, partial migration, checksum mismatch or drift | Stop deploy; preserve evidence/backup and design target-specific remediation |

Do not blindly rerun or mark migrations applied, `db push`, rebaseline or reset.
Prisma status alone does not prove manually defined constraints/triggers match.
Use a minimal compatibility checklist/manifest where needed, not a second registry
or automatic schema-repair engine.

### Rehearsal and deploy contract for 06

1. Verify the application/migration revision and usable backup/restore procedure.
2. Exercise real Prisma migration deploy from empty and supported upgrade targets
   on disposable infrastructure, separately from raw-SQL integration fixtures.
3. Capture pre/post integrity and lock/runtime behavior on representative data.
   For writes-paused migrations, stop all writers, not only hide UI buttons.
4. Run one controlled release operation using the direct migration role; prevent
   competing jobs and reuse the migration tool's established locking behavior.
5. Verify recorded history and required schema objects, run authorized scoped
   smoke reads, then enable a compatible API/frontend under 06.
6. Stop on failed/partial deploy. Inspect what committed before planning recovery;
   failed-migration resolution needs evidence and target-specific authorization.

02's `SELECT 1` readiness probe is not a schema gate. 06 must reject incompatible
history/schema even when the database responds. Feature owners provide approved
migrations and concrete index/query needs; 04 does not invent their entities.
Never edit applied historical migrations to conceal drift.

## 5. Backup and restoration

Before real data, approve maximum acceptable data loss, total restore time,
backup frequency/retention, encrypted storage outside the primary failure domain,
access/key rotation and named backup/restore operators. Coordinate personal-data,
offboarding and retention rules with 13. No dumps/keys/credentials in Git or public
storage; protect restored data as carefully as live data.

Select the smallest supported combination of provider-native recovery and
independently controlled encrypted backups after 05 verifies capabilities/limits.
A periodic logical dump is not point-in-time recovery between snapshots. Job
frequency alone does not prove the recoverable gap, especially with failed jobs,
cold wake or long dumps. Do not promise free-tier recovery or choose storage here.

Backups must be transactionally consistent and include application data, schema
objects and migration history. Document roles/grants/extensions/provider settings
that the backup does not include. Restore ownership/permissions deliberately;
do not accidentally restore admin access, obsolete credentials or active mail jobs.

### Mandatory isolated restore drill

1. Retrieve/decrypt an authorized backup and verify its integrity/time, without
   exposing keys or customer rows in logs.
2. Restore only to a separately verified isolated target. Never overwrite the
   running store to test recovery or connect the restored app to production mail/
   payment integrations. Prefer synthetic fixtures; approved real-data copies need
   production-equivalent controls and deliberate cleanup/retention.
3. Verify migration/schema parity, tenant/branch joins, members/grants, inventory
   versus movement deltas, sales/items, refunds/items, remaining return quantities,
   receipt snapshots, exact amounts and unique command IDs against reference data.
4. Exercise two-organization access/privacy plus safe synthetic checkout/refund/
   replay cases, proving no duplicate stock writes or lost tenant restrictions.
5. Measure the recoverable data gap and full elapsed time through validation and
   application reconnection—not only download/restore duration. Meet the approved
   targets or keep release blocked.
6. Restrict and clean up only the identified restored test target under approved
   rules; retain evidence/backups according to policy.

### Real incidents and rollback safety

Whole-DB restoration affects every organization and can rewind successful sales,
refunds, access changes and session revocations. Pause writes, preserve failed-
state evidence and require operator approval. Coordinate 03/07 session cutover so
restored revoked credentials cannot silently regain access.

Real-world payments/refunds after the recovered point may still have happened.
10 must define receipt/evidence review before resuming. 18 must not interpret a
missing restored request as proof that no payment/refund happened and blindly
replay it. No automated financial reconstruction, reconciliation module or
selective tenant-restore feature is implied.

Prefer compatible app rollback with additive schema retained where safe. A
nonreversible conversion needs reviewed roll-forward/restore procedures. A
pre-migration snapshot must not overwrite later store activity as a routine code
rollback. Never drop financial history to restore an older application version.

## 6. Credentials, pool budgets and outages

- Runtime credentials receive required application DML and existing sequence/
  trigger/function access, not migration/schema-admin authority. Test actual
  privileges; DB roles do not replace tenant-scoped application queries.
- Separate direct migration credentials for release operations and deliberately
  scoped backup access. No admin/migration secrets in frontend or normal runtime.
- Budget connections across replicas, deploy overlap, migrations, health and
  tests. Validate provider pooling/session behavior, memory and timeout budgets
  with realistic workloads; do not globally shorten financial queries for probes.
- Test cold wake, exhausted pools, connection loss during stock/checkout/refund,
  rollback and serialization retry. Reuse explicit same-ID financial recovery;
  never automatically create a new command to hide a timeout.
- Outages fail closed with safe diagnostics/readiness, not false authentication
  errors or hidden stale privileged data. 02/03 own HTTP boundaries; 10 alerts.

## 7. Implementation phases, acceptance and documentation

1. Inventory current commands and design minimal target/seed refusal safeguards.
   Test destructive-path rejection without risking application data.
2. Resolve §8/provider responsibilities with 05; document credential/environment
   separation without storing secrets.
3. Implement migration provenance/integrity preflight contracts for 06 and rehearse
   empty/upgrade/drift/failed-history scenarios on independently verified targets.
4. Establish approved backup/operator procedures using existing provider/PostgreSQL
   tools, then execute isolated restoration and collect measurable evidence.
5. Exercise pool/outage/real-DB integrity/concurrency and restored-session security;
   coordinate feature-specific schemas with their owners.
6. Obtain deep review for destructive safeguards, migration compatibility, least
   privilege and financial checks. Inspect task diff and preserve user changes.

Safe local gates from `backend/`, using installed tools:

```sh
npm run prisma:validate
npx tsc --noEmit --incremental false
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run lint
npm run build
```

After approved schema changes, generate/validate Prisma client. Real integration
tests require explicit verified disposable `TEST_DATABASE_URL`; test migration
deploy separately. This document deliberately supplies no ambient-target reset/
restore/migration command to copy-paste. No new dependencies without approval.

Acceptance requires target-refusal tests, fresh/supported Prisma upgrade history,
drift/failure release stops, no demo release seeding, least-privilege operation,
restored financial/access integrity, measured approved recovery targets and
cold/pool/outage tests. Record date, revision, redacted target identity, results
and unrun evidence. Valid syntax or passing unit tests cannot close restore gates.

Update the seed guide and `backend/test/README.md` after safeguards ship. Add
focused deployment/restore runbooks under `docs/development/` and implemented DB
operational contracts to `docs/modules/runtime-operations.md` alongside 02 where
appropriate. Feature docs change only after their behavior/schema actually ships.

## 8. Open decisions and risks

User confirmed October 24: at most 15 minutes of lost transaction history
(RPO ≤15 minutes) and safe service recovery within 2 hours (RTO ≤2 hours),
including validation and application reconnection, not just restoring a dump.
These are accepted targets, not demonstrated guarantees or permission to buy
hosting. Keep the release gate open until a restore drill proves both. Even
meeting them does not reconstruct missing real-world payments.

Also resolve backup location, operator/key ownership, retention and actual
provider export/restore capability with 05/13. If free infrastructure cannot meet
accepted targets, revise hosting/budget or restrict testing to synthetic records;
never lower the safety claim silently.

Main risks: wrong-target execution, rewritten/partial migrations, destructive seed
bypass, false backup success, restored revoked access, whole-tenant data loss,
pool starvation and duplicate real-world payment actions after a restore. Keep
them visible in 06/10/14/18; no automatic reset/repair/replay is a fallback.
