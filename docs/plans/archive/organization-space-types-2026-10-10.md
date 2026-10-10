# Organization space types and workspace tabs

**Status:** Approved by the user's October 10, 2026 request; implemented and
validated locally. The user explicitly chose organization-wide types. See
[validation](../../validation/space-types-2026-10-10.md). The broader workspace QA
recorded in the current plan remains open; live database rollout is not included.

### Scope and contracts

- Add Spaces and Types tabs to the dedicated workspace for owners/managers.
  Types is an organization-wide catalog, available without choosing a branch.
  Merchants retain own Spaces only; cashiers remain excluded.
- Owners create type names (trimmed, 1–80 characters, case-insensitively unique
  within their organization). Managers read the shared catalog. No rename,
  deletion, archive, counts, pricing, or new permissions are included.
- Space creation/edit and branch type filtering use catalog choices. The space
  form provides Add type inline, preserves other form values, selects the created
  type, and displays recoverable errors. A created type remains in the catalog
  if the space form is subsequently cancelled.
- Use the existing string `type` request/response contract. Introduce SpaceType
  with organization ownership and a tenant-safe composite FK from Space's
  organization/type label to the catalog. No client-provided tenant is trusted.
- Backfill catalog names from existing spaces, including archived ones, deduping
  case-insensitively with deterministic canonical spelling. Normalize matching
  Space labels to that spelling without changing identities or occupancy.
- A database trigger registers/canonicalizes legacy string writes atomically,
  allowing old and new API/frontend versions to coexist. Failed space writes
  must roll back implicit type creation. New dedicated type creation rejects
  duplicates with 409. No destructive removal of the string contract is included.
- GET `/organizations/:organizationId/space-types` returns catalog identities
  and names without counts. Merchants receive only names used by their own
  accessible current/past spaces; owners/managers receive the shared catalog.
  POST on that path is owner-only and rejects unknown/invalid fields.
- Maintain current membership reload, branch isolation, occupancy invariants,
  submission locks, retry, obsolete-read protection, and keyboard/focus behavior.

### Validation and rollout

Validate/generate Prisma, lint/typecheck/build, frontend tab/catalog/inline-create
and regression tests, and disposable PostgreSQL migration/backfill, tenant FK,
case-insensitive uniqueness, concurrency, legacy writes/rollback, role and own-only
reads, and unchanged occupancy integration tests. Browser-check when available;
record unavailable tooling and baseline failures separately. Update spaces and
frontend module docs and a validation record. No dependencies or production
operations are authorized.

Apply the additive catalog migration before deploying the new API and frontend.
Existing clients retain their string contracts. Rollback the app first; if a
schema rollback is required, drop the Space catalog FK and registration trigger,
then its function and catalog table, retaining Space strings and occupancy data.
Canonical spelling is retained on rollback; capture a backup first if exact old
capitalization must be restored. Never apply a production rollback automatically.
