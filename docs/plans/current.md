# Current Implementation Plan

**Status:** Approved September 15, 2026. Implementing by reviewable parts; each
part remains uncommitted until reviewed and approved.

Part 1 was reviewed, approved and committed as `ae193ff`. Part 2 was reviewed,
approved and committed as `1e75552`. Part 3 implementation is complete and
remains uncommitted for review. Backend format/lint/build, 91 focused inventory
unit tests and 106 focused HTTP authorization tests pass. Frontend format/lint,
type checking, all 765 tests across 89 files and the production build pass.

## Branch inventory replenishment visibility

### Confirmed direction

Use a different low-stock threshold for each branch placement because quantities,
prices and demand are already independently tracked per branch. Thresholds support
staff awareness only; they do not reserve, order or transfer stock.

### Business rules

- Add `lowStockThreshold` to each branch inventory placement as a nonnegative
  whole number within PostgreSQL integer range. New and existing placements use
  `5` by default; owners/managers can change it. Setting it to `0` disables the
  Low stock warning but never suppresses Out of stock.
- Derive, never persist, one stock status:
  - **Out of stock:** quantity equals `0`.
  - **Low stock:** quantity is greater than `0`, threshold is greater than `0`,
    and quantity is less than or equal to the threshold.
  - **In stock:** every other valid quantity/threshold combination.
- Status changes immediately as authoritative stock commands change quantity or
  an authorized threshold edit succeeds. No background job or notification is
  needed.
- Owners read/write thresholds and see all tenant placements. Managers read/write
  only assigned branches. Merchants read their own placement threshold/status and
  own-only summaries but remain unable to mutate inventory. Cashiers retain no
  inventory access or summary.

### Smallest complete scope

- Add the schema field, database default/check constraint and migration backfill.
  Preserve existing tenant/branch composite relationships and stock constraints.
- Extend placement creation—including the optional product opening-stock path—to
  accept an optional threshold that defaults to `5`. Validate it at the API and
  database boundaries without changing price or opening-stock atomicity.
- Add a focused threshold update route on a scoped placement. Reuse current
  organization membership, role, assigned-branch, object-level and foreign-tenant
  not-found behavior. Threshold edits do not create inventory movements because
  they do not change quantity.
- Include `lowStockThreshold` and derived `stockStatus` in inventory placement
  responses. Add a `stockStatus` list filter that composes with existing search,
  merchant and product lifecycle filters without widening merchant visibility.
- Add a branch inventory summary read returning in-stock, low-stock and out-of-
  stock placement counts. Apply the same role-aware placement visibility as the
  directory: owners/managers see authorized branch totals; merchants see only
  their own placements. Do not expose product or merchant details in the summary.
- Show threshold and a clear text/color status indicator in inventory directory
  rows and placement details. Add Stock status filtering, distinct empty results
  and threshold editing for owners/managers with existing live validation and
  pending-write protections.
- Add threshold input to Add product placement and the product opening-inventory
  section, initially `5`, with explanatory copy that `0` disables only low-stock
  warnings. Keep opening quantity optional behavior unchanged.
- On branch details, show authorized inventory health counts with a link to the
  Inventory page. Low/out-of-stock links open the corresponding filtered directory
  and retain the existing branch selection. Merchant copy explicitly says counts
  cover own placements; cashiers receive no inventory health data.
- Reuse the existing row-level Receive stock modal from low/out-of-stock results.
  Do not create a second receipt implementation or weaken stock command safeguards.
- Update OpenAPI contracts and affected module documentation after implementation.

### Security and consistency requirements

- Every threshold and summary query includes the active `organizationId` and
  `branchId`; merchant queries additionally enforce the linked merchant identity.
- Client-supplied stock status is never trusted. Backend responses and filtering
  derive it from current quantity and threshold in the same scoped database read.
- Threshold updates cannot change quantity, price, product, branch, organization
  or movement history. Existing receipt/adjustment/sale/refund transactions remain
  authoritative for quantities.
- Unknown filter values, fractional/negative/out-of-range thresholds and unknown
  DTO fields are rejected. Guessed foreign IDs retain absent-object behavior.
- Summary counts and filtered rows must reconcile for the same role, branch and
  database state. Obsolete frontend reads cannot restore counts or rows after a
  branch, role, user or access change.

### Explicit exclusions

- No supplier, purchase order, replenishment request, approval, transfer,
  reservation, forecast or automatic stock mutation.
- No email, SMS, push, in-app notification center, scheduled task or background
  worker.
- No organization-wide cross-branch inventory dashboard, combined quantities or
  shared threshold across placements.
- No per-product default threshold, category threshold, unit conversion, decimal
  quantity, safety-stock formula or sales-velocity recommendation.
- No threshold history/audit entity and no change to immutable quantity movement
  history. General audit logging remains outside current scope.
- No cashier inventory visibility and no expansion of merchant access beyond own
  placements in branches already authorized by current rules.
- Preserve unrelated root package and performance-audit changes.

### Delivery by parts

1. **Schema and placement contracts.** Add the threshold migration, constraints,
   response fields and placement/opening-stock inputs with backend unit,
   PostgreSQL integration and HTTP authorization/isolation coverage. Update
   OpenAPI and relevant module docs. Stop uncommitted for review; commit only
   after approval.
2. **Threshold editing, derived status and filtering.** Add the scoped update
   endpoint, derived response status and composable list filter. Add backend and
   frontend API/schema coverage, then implement directory/detail threshold and
   status UI plus creation inputs. Stop uncommitted for review; commit only after
   approval.
3. **Branch inventory health summary.** Add the role-reduced summary endpoint and
   responsive branch-detail health presentation, including filtered Inventory
   links and existing quick receipt action reuse. Cover owner, assigned manager,
   merchant own-only, cashier denial, tenant isolation, stale reads and empty
   states. Stop uncommitted for review; commit only after approval.
4. **Final verification and delivery.** Validate/generate Prisma; run applicable
   backend and frontend formatting, lint, type checking, unit, HTTP e2e,
   PostgreSQL integration tests and production builds. Perform rendered status,
   filters, forms, responsive layout, keyboard/focus and 200% zoom QA if browser
   access is available; otherwise obtain a new explicit milestone waiver. Record
   results, stop for final review, then commit and archive only after approval.

### Acceptance checks

- Migration gives every existing placement threshold `5`, enforces a bounded
  nonnegative integer and leaves every quantity, price and movement unchanged.
- New placements from either supported creation path default to `5` unless an
  authorized valid threshold is supplied; atomic opening-stock rollback behavior
  remains unchanged.
- Status boundaries are exact: quantity `0` is Out of stock regardless of
  threshold; quantities `1..threshold` are Low stock only when threshold is
  positive; threshold `0` or quantity above threshold is In stock.
- Filters compose predictably and return only authorized scoped placements.
  Summary counts match the same role-scoped unfiltered inventory population.
- Owners/managers can edit a threshold but cannot use that route to alter another
  field or inaccessible branch. Merchants/cashiers cannot mutate it; merchant
  reads and counts never disclose another merchant's placements.
- Inventory rows/details communicate quantity, threshold and status without color
  alone. Live validation preserves invalid input and focuses the first invalid
  field on submit. Pending writes prevent duplicate or conflicting controls.
- Branch-detail health remains useful at desktop/mobile widths and links to the
  exact branch/status view. Quick Receive stock continues to refresh authoritative
  quantity/status and preserve idempotency and access-loss behavior.
- No excluded procurement, transfer, notification, worker or cross-branch feature
  is introduced, and unrelated working-tree changes remain unmodified.
