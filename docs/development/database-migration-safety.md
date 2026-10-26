# Database migration safety

The repository has two separate local safety paths:

- `npm run prisma:reset:demo` is destructive and only accepts the explicitly
  confirmed loopback `DEMO_DATABASE_URL` described in
  [database seeding](database-seeding.md).
- `npm run prisma:migration:preflight` is read-only and inspects a separately
  supplied target's identity and Prisma migration history. It never falls back
  to `DATABASE_URL` or `DIRECT_DATABASE_URL`.

From `backend/`, run the preflight only after the target has been approved:

```bash
MIGRATION_PREFLIGHT_DATABASE_URL=postgresql://migration-reader:password@127.0.0.1:55439/concept_store_test \
MIGRATION_PREFLIGHT_DATABASE_NAME=concept_store_test \
MIGRATION_PREFLIGHT_CONFIRM=I_UNDERSTAND_READ_ONLY_MIGRATION_PREFLIGHT \
npm run prisma:migration:preflight
```

The result is one of `empty`, `upgrade-needed`, `current` or `unsafe`. The
preflight compares applied migration names and SHA-256 checksums with the
repository files and stops on an unresolved failed/rolled-back latest attempt,
unknown migrations, checksum drift or reordered history. If Prisma history
contains a failed attempt that was explicitly resolved and followed by a later
successful attempt for the same migration, the latest successful attempt is
used for state and ordering while every attempt is still checksum-checked. It
reports only the database name, state, pending migration names and bounded issue
text; it does not print a URL, credential, row data or migration logs.

`empty` and `upgrade-needed` are rehearsal states, not permission to deploy.
An `unsafe` result requires target-specific investigation and preserved evidence;
do not rerun, mark applied, rebaseline, reset or edit historical migrations to
make the check pass. This tool does not prove manually created constraints,
triggers, provider backup capability, least-privilege grants, restore targets,
RPO/RTO, pool behavior or application compatibility. Those remain Plan04/05/06
gates and require an approved disposable or hosted target.
