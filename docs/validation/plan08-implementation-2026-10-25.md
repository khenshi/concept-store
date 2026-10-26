# Plan 08 implementation and acceptance evidence

Date: October 26, 2026

Status: Implementation and hosted development database cutover complete. Plan 08
remains active until matching API/frontend deployment and browser/API
qualification are recorded; this record does not certify that deployment gate.

## Scope

Payment Accounts configuration, branch availability, sale/refund account snapshots,
and exact Received/Refunded/Net Received reports. One account per sale/refund;
split payments, reconciliation and payouts remain excluded.

## Management UI checks

- Owner-only management, versioned edits, disabled invalid/unchanged Save,
  immutable system Cash presentation and branch-safe API decoding have focused
  tests. The management/navigation/invitation regression run passed 33 tests.
- Synthetic Chrome checks passed at 1440×1000 and 390×844. The account list and
  create modal rendered without JavaScript errors or page-level horizontal
  overflow. Table scrolling stays inside its container. Invalid create drafts
  kept Save disabled. Screenshots were inspected after one padding correction.
- Browser API responses were intercepted synthetic fixtures; no real account,
  user, organization or database record was created by browser QA. This proves
  rendering and interaction only, not authenticated hosted API behavior.
- Existing design tokens, OperationalCollection, OperationalTable,
  PaginationControls, FormDialog, custom dropdowns and BranchAccessPicker were
  reused. No UI dependency or design-system replacement was introduced.

## Database and deployment boundaries

- Financial and migration verification uses the separately created local
  `concept-store-plan08-postgres-clean` PostgreSQL 17 container, database
  `concept_store_test` on `127.0.0.1:50067`.
- The complete repository migration chain (20 migrations) applied successfully
  to the clean target. The guarded demo seed completed successfully after the
  migration and was verified with one Cash account, Cash enabled/all-branch/no-
  reference invariants, selected BPI branch links, disabled Maya data and
  seeded Sale/Refund account flows.
- Focused Plan 08 integration coverage passed 64 tests across the account and
  Reports suites. The complete backend PostgreSQL integration run passed 11 of
  12 suites: 329 passed, 1 intentionally skipped, 0 failed. The skipped suite
  is the existing environment-dependent runtime path, not an account test.
- The explicitly verified development Neon target (`neondb`, `public`,
  `NODE_ENV=development`) was reset under the approved disposable-data
  authorization. Before reset it contained 3 sales and 1 refund; 23 application
  tables were cleared while `_prisma_migrations` was preserved.
- The failed Plan 08 attempt was explicitly resolved, the full 20-migration
  chain was reapplied successfully, and the read-only migration preflight now
  reports `current` with no pending migrations or issues. The historical failed
  attempt remains recorded and is superseded by the later successful attempt.
- The guarded seed completed successfully with one enabled all-branch Cash
  account, selected BPI branch assignments, renamed GCash history, disabled
  Maya, 3 sales and 1 refund. Read-only account totals are Received `2725.50`,
  Refunded `450.00`, and Net Received `2275.50`.
- The seed/preflight guards now correctly accept a resolved failed attempt when a
  later attempt for the same migration completed; unresolved latest attempts
  remain blocked. Remote seed transactions use a bounded 30-second timeout for
  the disposable fixture workload only.
- The new forward migration deliberately refuses nonempty Sale/Refund tables.
  Existing real financial records require a preservation migration instead of
  this development-only cutover.
- After cutover, still test hosted account availability, checkout, partial
  cross-account refunds, history/replay, report totals and receipt printing
  against matching API/frontend versions before closing the plan. Broader
  launch qualification remains owned by Plans 11–14.

## Frontend regression gates

- Full frontend test run: 1,206 tests passed.
- TypeScript and production webpack build passed, including the new thin
  Payment Accounts route. The existing multiple-lockfile build warning remains.
- Full frontend lint has zero errors and the same four pre-existing unused-symbol
  warnings in `inventory-placement-form.tsx`.
- The changed Payment Accounts/Reports files pass focused formatting checks. A
  repository-wide frontend format check still reports the pre-existing clean
  `features/auth/model/auth-context.tsx` formatting issue; no behavior change was
  made there.
- Dynamic account selections, strict account/snapshot schemas, history filters,
  receipts, saved-command matching, actual refund-account flows, signed-net
  chart fallback and complete totals are covered by updated or new tests.
- New dependencies: none; package manifests and lockfiles are unchanged.

## Independent review

A deep agent reviewed Cash constraints, tenant/branch authorization, account
availability, saved-command replay, immutable snapshots, actual refund-account
aggregation and the management screenshots. No confirmed runtime blocker was
found. Its requested account-race rejection and exact report account-ID/value
assertions are now covered by the passing database tests. The reviewer
separately ran 107 backend and 140 frontend focused tests successfully; those
are local tests rather than database or deployment evidence.

## Remaining gates

- Deploy the matching backend/frontend commit and reload/sign in against this
  migrated target. Verify Owner account management, branch availability,
  checkout, partial refunds through a different account, disabled-account
  history/replay, exact report totals/toggle and receipt printing in the hosted
  environment.
- Reports All Branches remains the next separately approved feature plan; this
  Plan 08 implementation supports account aggregation over its eventual
  authorized branch scope but does not implement that selector.
