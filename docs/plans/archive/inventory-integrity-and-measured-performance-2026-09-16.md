# Inventory integrity and measured Inventory/POS performance — completed plan

**Status:** Completed and approved September 16, 2026. Parts 1–3 are committed;
Part 4 verification and its documented caveats were approved for archive.
Deliver in reviewable parts. Stop each part uncommitted for review; commit it and
start the next part only after approval.

## Inventory integrity and measured Inventory/POS performance

### Confirmed direction

Strengthen the existing quantity-tracked inventory and checkout paths before
adding purchasing, transfers, notifications, or another large feature. Detect
stock/ledger inconsistencies without changing balances. Measure actual database
and request costs before optimizing existing Inventory and POS reads.

### Existing behavior and dependencies

- Each branch placement starts at zero stock. Optional product opening stock
  creates one positive RECEIPT in the same transaction. Later RECEIPT,
  ADJUSTMENT, SALE, and RETURN movements are immutable and record signed deltas.
  Atomic stock commands, checkout, and refunds update the placement and insert
  their movement in one transaction. Price/threshold edits create no movement.
- Inventory directory filtering and health counts currently load all authorized
  matching placements, then derive/filter/count stock status in application
  memory. Movement history is unpaginated. POS search has a 100-row cap; exact
  code lookup has no result cap because collisions must remain selectable.
- Existing organization membership, assigned-branch, merchant-own scope,
  request validation, and not-found behavior are security boundaries. The
  untracked root performance-audit draft is input for this focused plan, not
  authority to optimize every module.

### Business rules and smallest complete scope

1. **Read-only reconciliation.** For each selected placement, compare current
   quantity with the exact signed sum of its immutable movements, treating no
   movements as zero. A zero-stock placement without movements is consistent;
   a positive placement without movements is a mismatch. Include all four
   movement types and compare using database integer/numeric arithmetic, not
   JavaScript floating point. Do not assume timestamp/ID order equals commit
   order. Return only mismatches, with placement ID, product identity, saved
   quantity, summed movement quantity, and signed difference. Never repair,
   delete, or insert stock/movements as a side effect.
2. **Staff diagnostics.** Add an on-demand, branch-scoped, bounded/paginated
   diagnostic API and a modest Inventory UI entry for owners and managers only.
   Owners may inspect any tenant branch; managers only assigned branches.
   Cashiers and merchants cannot access diagnostics, even for their own stock.
   Read all comparison inputs in one consistent database snapshot so concurrent
   checkout/receipt/refund cannot create a false mismatch. Empty results explain
   that no mismatch was found in the inspected branch. A mismatch links to the
   existing placement detail; no correction workflow is added.
3. **Measured read optimization.** Capture repeatable baseline `EXPLAIN (ANALYZE,
   BUFFERS)` and representative API timings/query counts for branch Inventory
   directory/status filters, health summary, movement history, POS search, and
   exact code lookup on disposable, realistically scaled test data. Optimize
   only demonstrated bottlenecks. At minimum, evaluate database-side stock-
   status filtering/counting and bounded movement-history pagination so these
   reads do not materialize an entire large branch/history in server memory.
   Preserve the three status rules, search semantics, deterministic ordering,
   role-reduced responses, and exact-code ambiguity behavior. Add/change an
   index only when the measured plan supports it; record before/after evidence.
4. **Frontend continuity.** Keep current Inventory/POS navigation and styling.
   Add diagnostic loading, empty, error, and retry states; clear stale results
   after branch, role, user, or access changes. If movement history becomes
   paginated, provide an accessible way to load older entries without losing
   current stock context. Do not add a general data-fetching/cache framework.

### Security and consistency requirements

- Every diagnostic and optimized inventory query includes active
  `organizationId` and `branchId`, with existing role/object checks. Guessed
  foreign or unassigned IDs behave like absent objects. DTO whitelisting rejects
  unknown fields and pagination limits are bounded.
- Diagnostic results are advisory snapshots, not authorization to mutate stock.
  They must not expose other branches, merchants, member identities, private
  sale/refund links, or movement actors.
- Filtering, summary counts, and displayed statuses must agree for the same
  authorized branch, role, filters, and database state. Reconciliation must
  account for zero-stock placements and valid opening receipts.
- Existing checkout, stock-command, refund, replay/idempotency, price, threshold,
  and merchant privacy contracts remain unchanged. A performance optimization
  must not weaken a transaction boundary or widen tenant/branch access.
- Performance tests use isolated disposable PostgreSQL data. Never benchmark by
  resetting, migrating, or seeding an application database.

### Explicit exclusions

- No automatic repair, balancing movement, stock overwrite, transfer, or
  adjustment shortcut. A detected mismatch requires a separate reviewed plan
  and human investigation before any correction mechanism.
- No organization-wide dashboard, scheduled scan, alert, notification, audit-log
  entity, queue, Redis, microservice, or new infrastructure.
- No blanket optimization of Products, Sales, Reports, Merchants, settlements,
  or other modules. No product images/files or unrelated frontend redesign.
- No promise of a specific latency target without a measured baseline and
  realistic test conditions. Preserve unrelated root package and performance-
  audit worktree changes.

### Delivery by parts

1. **Reconciliation contract and database read.** Define the bounded diagnostic
   API response/query and implement a repeatable-read, tenant/branch-scoped,
   read-only reconciliation. Cover empty ledger, opening stock, all movement
   types, deliberate mismatch, role denials, foreign IDs, and concurrent writes
   in unit, HTTP, and PostgreSQL tests. Update OpenAPI and module docs. Stop
   uncommitted for review.
2. **Staff diagnostic UI.** Add an owner/manager Inventory entry and results
   view using existing shell/design patterns. Cover loading/empty/error/retry,
   placement links, pagination, role/branch switches, stale reads, and no
   cashier/merchant request or visibility. Stop uncommitted for review.
3. **Measured Inventory/POS optimization.** Establish and record baselines first;
   implement only justified query, index, and/or pagination changes within the
   approved Inventory/POS scope. Preserve all response/authorization semantics
   or explicitly document a necessary paginated contract change and frontend
   adaptation. Add scale, equality, concurrency, and isolation regressions.
   Stop uncommitted for review.
4. **Final verification.** Run Prisma validation/generation (if schema changes),
   formatting, lint, type checking, unit, HTTP, PostgreSQL integration, and
   production builds. Compare before/after plans and timings under the same
   disposable fixture. Perform rendered responsive, keyboard/focus and 200%
   zoom QA if a browser is available, otherwise obtain a new explicit waiver.
   Update affected `docs/modules/`, record results, stop for final review,
   then commit and archive only after approval.

### Final verification record

- No Prisma schema changed; validation passed and client regeneration was not
  needed. Backend formatting, lint, build, 411 unit tests, 213 HTTP tests and
  244 PostgreSQL integration tests passed. Frontend formatting, lint,
  typecheck, build and 776 tests passed. Benchmark before/after plans and
  timings are in `docs/development/inventory-pos-performance-2026-09-16.md`.
- The user waived rendered responsive, keyboard/focus and 200% zoom QA for the
  new Inventory diagnostic and history UI on September 16, 2026. These checks
  were not performed.
- Repeated full HTTP runs intermittently returned unexpected 401/404 statuses
  in existing Reports and Products/Inventory tests; focused repetitions and
  later full runs passed. This remains an unresolved test-stability caveat.
- The unfiltered directory remains unbounded because its full response also
  drives the Add product placement picker. Its measured limitation is recorded
  without changing that coupled contract in this milestone.

### Acceptance checks

- A consistent placement reports no mismatch; seeded corruption is detected
  precisely, without any database write by the diagnostic.
- A concurrent valid stock write cannot appear as a transient mismatch within
  one diagnostic snapshot.
- Owner/assigned-manager diagnostics are correctly scoped; merchant/cashier and
  cross-tenant/unassigned requests disclose no diagnostic data.
- Stock-status directory/summary results reconcile with pre-optimization rules,
  while large authorized branches and histories avoid unbounded application-
  memory materialization in the optimized paths.
- POS exact code lookup still exposes all distinct matching candidates for
  explicit ambiguity selection, and cashier search remains fast and scoped.
- Measured before/after evidence supports each optimization; all prior stock,
  sale, refund, and access-control regressions pass.
