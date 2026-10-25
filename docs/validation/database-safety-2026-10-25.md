# Plan04 database safety validation — October 25, 2026

Scope: disposable migration rehearsal for the staged Plan04 implementation.
No application database, pilot target or production credential was used. The
guarded demo seed populated only the synthetic source target for this drill.

## Target

- PostgreSQL 17 in the explicitly named Docker container
  `concept-store-plan04-migration-20261025`.
- Synthetic database `concept_store_plan04` on loopback port `55440`.
- The container used Docker's anonymous PostgreSQL data volume and no host or
  named volume; `--rm` cleanup removed the disposable container and its volume.
- Target identity was checked by the preflight as database
  `concept_store_plan04`, schema `public`.

## Results

1. Read-only migration preflight classified the fresh target as `empty`.
2. `prisma migrate deploy` applied all 18 repository migrations successfully.
3. The read-only preflight rerun classified the target as `current` with no
   pending migrations or issues.
4. A guarded synthetic fixture was backed up in custom PostgreSQL format in
   `0.12s` and restored to a separate target in `0.15s`.
5. Source and restored aggregate counts matched: 1 organization, 2 branches,
   4 memberships, 5 inventory rows, 10 inventory movements, 3 sales, 4 sale
   items, 1 refund and 1 refund item.
6. The restored target classified as `current` with no pending migrations or
issues, and the production start command API reconnected successfully: `/`,
   `/health/live` and `/health/ready` returned 200.
7. Focused migration/seed safety tests passed: 8 tests across 2 suites.
8. Backend build, typecheck and lint passed for the preflight implementation.

The repository does not claim a real supported-upgrade target, schema-object
drift, failed-history repair, least-privilege role, pool/outage, two-organization
privacy, financial replay, provider backup capability or RPO/RTO result from
this rehearsal. Upgrade-needed, checksum-drift, failed-history and
ordering-divergence behavior is covered by pure focused tests; no unsafe history
was written to the disposable target.

The disposable target was stopped after validation. No application database was
migrated, reset, seeded or connected.
