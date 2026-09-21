# Branch Inventory

**Status:** Implemented; rendered QA for inventory integrity/performance and
earlier replenishment visibility was explicitly waived.

The later inventory integrity/performance milestone adds read-only staff
reconciliation, database-side stock filters/counts, and bounded movement
history. Final automated verification on September 16, 2026 passed Prisma
validation; backend formatting, lint, build, 411 unit tests, 213 HTTP tests,
and 244 PostgreSQL integration tests; and frontend formatting, lint, typecheck,
build, and 776 tests. The opt-in performance fixture and before/after plans are
recorded in [the measurement note](../development/inventory-pos-performance-2026-09-16.md).
The user explicitly waived rendered responsive, keyboard/focus, and 200% zoom
QA for the Inventory diagnostic and history screens. Those checks were not
performed. The later HTTP reliability part gave all six HTTP suites one
persistent local listener per suite; 30 consecutive full runs passed without
changing runtime authorization or expected responses.

The current bounded-read work changes the directory response from an array to
a page and adds the eligible-product read. The frontend now consumes both
contracts with paged, stale-response-safe loading. Backend PostgreSQL
integration, unit, HTTP, lint and build checks and the full frontend suite,
lint, typecheck and production build pass. Final verification reran 413 backend
unit, 214 HTTP, 245 PostgreSQL integration and 783 frontend tests; formatting,
lint and both builds passed. The user explicitly waived rendered responsive,
keyboard/focus and 200% zoom QA for this pagination milestone on September 17,
2026; those checks were not performed. The bounded-read fixture and query-plan
comparison are recorded in [the September 17 measurement](../development/inventory-browsing-performance-2026-09-17.md).

The later inventory workflow usability refinement passes the complete frontend
suite (751 tests across 88 files), lint, type checking, formatting and production
build. Its rendered responsive, modal, searchable-picker keyboard/focus and 200%
zoom QA was explicitly waived September 15, 2026 and was not performed.

The [manual refund API](refunds.md) atomically creates constrained positive RETURN
movements when staff restock original sold placements. Existing receipt/adjustment
commands do not create returns. Response selections omit private sale/refund links
and retain merchant actor exclusion. Inventory schemas accept positive RETURN
deltas and the existing history labels them Return, not Adjustment. Refund reasons
are not exposed through stock history; RETURN uses Returned goods restocked.

## Responsibilities

Maintain one quantity-tracked placement per product/branch, a branch-specific PHP
selling price, a per-placement low-stock threshold, and immutable receiving/
adjustment history. Different placements of the same product have independent
prices, thresholds and balances. No transfer,
reservation, purchasing, or deletion workflow is provided. The separate
[sales checkout API](sales.md) atomically creates SALE deductions in this history;
existing receipt/adjustment endpoints and role permissions remain unchanged.
Staff receipts and merchant own-item sales are available in separate sales history
screens, never through the private sale-item link in inventory movement responses.
Cashier POS access does not grant inventory history or stock mutation access.

## API and authorization

```text
POST  /organizations/:organizationId/branches/:branchId/inventory
GET   /organizations/:organizationId/branches/:branchId/inventory?q=&merchantId=&status=&stockStatus=&limit=&cursor=
GET   /organizations/:organizationId/branches/:branchId/inventory/eligible-products?q=&limit=&cursor=
GET   /organizations/:organizationId/branches/:branchId/inventory/summary
GET   /organizations/:organizationId/branches/:branchId/inventory/reconciliation?limit=&cursor=
GET   /organizations/:organizationId/branches/:branchId/inventory/:inventoryId
PATCH /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/price
PATCH /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/threshold
POST  /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/receipts
POST  /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/adjustments
GET   /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/movements?limit=&cursor=
```

All routes require authentication and organization membership. Owners read/write
all tenant inventory; managers read/write only assigned branches. Linked merchants
read only own merchant placements/history, with actor IDs omitted. Merchant writes
and all cashier inventory access are denied. Every inventory/movement query includes
organization and branch scope; filtered reads also enforce product ownership/access.
Related branches, products, and merchant filters are resolved inside the active
tenant. Foreign records use not-found behavior. UUID v4 validation and global DTO
whitelisting reject malformed IDs and unexpected fields.

## Placements and prices

- Placement creation accepts product ID, price, a required nonnegative whole-unit
  `initialQuantity`, and an optional nonnegative whole-unit `lowStockThreshold`.
  The threshold defaults to `5`; positive opening stock creates an attributed
  RECEIPT in the placement transaction, while explicit zero creates no movement.
  Setting the threshold to `0` is retained for the low-warning opt-out behavior.
  Duplicate product/branch placement returns `409`.
- New placements require an active product and active merchant.
- Price requests use positive decimal strings with at most 10 integer and two
  fractional digits. Numeric JSON values, scientific notation, and zero are
  rejected. Prisma Decimal stores prices; responses have exactly two decimals.
- Price edits change only price, not quantity. Existing inactive product/merchant
  records remain editable and readable.
- Inventory and product-placement responses include the bounded integer threshold
  and a derived `IN_STOCK`, `LOW_STOCK`, or `OUT_OF_STOCK` status alongside
  product identity and merchant name/status. Out of stock always means zero;
  positive stock at or below a positive threshold is low; all other positive
  stock is in stock. A zero threshold disables only the low-stock warning.
- Threshold edits accept only integers from `0..2147483647` and change neither
  quantity, price nor movement history. Owners and assigned managers may edit;
  merchants retain own-placement read access only.
- Search matches product name/SKU case-insensitively and barcode case-sensitively.
  Merchant/product-status/derived-stock-status filters are optional and compose
  without widening the role-aware placement scope. Lists order by product name
  then inventory ID. The directory now returns `{ items, nextCursor }`, with
  default page size 50 and maximum 100. Each database read asks for at most
  `limit + 1` placements. Stock-status filtering is applied in PostgreSQL
  using the same zero/threshold rules as the displayed status. A cursor is
  valid only for the same organization, branch, member/role, and active filters;
  a missing or incompatible cursor returns 404 without revealing rows.
- The staff-only `eligible-products` read returns `{ items, nextCursor }` with
  the same 50/100 bounds and stable product-name/ID order. It includes only
  active products of active merchants not yet placed in the selected branch.
  Owners may see all tenant products; assigned managers keep their existing
  product scope (products placed in at least one of their assigned branches),
  so a completely unplaced product is not newly exposed to managers. Search
  retains case-insensitive name/SKU and case-sensitive barcode matching.
  Merchant and cashier callers are denied. Eligibility is advisory: the
  placement create operation remains authoritative and returns 409 for a
  concurrent duplicate.
- The summary route returns only `inStock`, `lowStock`, and `outOfStock` counts.
  It derives them from the same current quantity/threshold rules and role-aware
  placement scope as directory reads. Owners and assigned managers see the
  authorized branch; linked merchants see own placements only; cashiers are
  denied. Empty authorized scopes return three zeroes and no product or merchant
  details. Three database counts run in one repeatable-read snapshot, without
  materializing placement rows in the application.
- Composite foreign keys prevent cross-tenant product/branch placements and
  cross-branch movement references. Database checks protect prices, quantities
  and nonnegative thresholds. The migration backfills existing placements to `5`.

## Stock commands and history

The read-only reconciliation route is limited to owners and managers (only
assigned branches for managers). It returns only mismatched placements, ordered
by placement ID with a default page size of 25 and maximum of 100. The optional
UUID cursor is the last returned placement ID. Each result contains product ID,
name and SKU, saved quantity, exact decimal-string sum of all signed RECEIPT,
ADJUSTMENT, SALE and RETURN deltas, and saved-minus-ledger difference. A missing
ledger counts as zero; an empty page with no next cursor means no mismatches
were found in that branch. The comparison uses one repeatable-read snapshot,
does not modify stock or movements, and exposes no actor, sale or refund links.
Cashiers and merchants cannot call it. It is an advisory diagnostic, not a
stock-repair command.

The Inventory directory offers an on-demand Stock integrity panel to owners
and managers after branch access is verified. It makes no diagnostic request
until the user starts a check, then shows loading, no-mismatch, mismatch, and
retryable error states. Results link to existing placement details and can be
loaded in bounded pages. A rerun clears previous results; branch, user, role,
access, and successful stock-write changes clear them as well. Merchant and
cashier views neither show this panel nor request its data. No correction
control is available from a mismatch.

- Receipt requires a positive integer quantity and UUID request ID. The server
  records the system reason `Stock received`; users do not need to enter one.
  Product and merchant must be active for a new receipt.
- Adjustment requires a nonzero signed integer delta, reason, and request ID.
  It is not an absolute stock replacement and may correct inactive records.
- Quantities stay within `0..2147483647`. Requests that would underflow/overflow
  return `409`; integer validation rejects invalid command values.
- A bounded atomic increment and movement insertion share a read-committed
  PostgreSQL transaction. The updated row remains locked until commit, preserving
  the movement's resulting balance. A failed movement write rolls back stock.
- Request IDs are unique per organization. Replaying the same inventory, branch,
  operation and delta returns the original receipt without another stock change;
  adjustment retries also require the same reason. Replays work even if lifecycle
  state has subsequently changed.
- A request ID reused for different content returns `409`. Concurrent duplicate
  uniqueness/range failures resolve the committed original after rollback.
- Movement actor comes from authenticated context. Replays retain original actor
  attribution. Owner/manager history returns actor IDs, not personal user
  information; merchant history omits actor IDs.
- History is ordered by timestamp descending then movement ID descending. The
  endpoint returns `{ items, nextCursor }`, defaulting to 50 movements with a
  maximum of 100 per page. A next cursor is the last returned movement ID and
  must belong to the same tenant, branch, and placement. Invalid/foreign cursors
  do not disclose movement data. The detail view can load older pages while
  retaining current stock and prior pages; refreshes clear old pages. There is
  no movement mutation or deletion endpoint.
- Command responses are historical movement snapshots; clients must refresh
  current inventory after success rather than treating a replay as current stock.
- No stock write touches another branch's placement.
- Persisted SALE movements display as sales and require negative deltas. Their
  private sale-item link is excluded from all existing movement responses; merchant
  history still omits actor IDs. Public receiving/correction contracts are unchanged.

## Delivery state

Final automated replenishment-visibility verification passes Prisma formatting,
validation and generation, backend formatting/lint/build, 410 unit tests across
34 suites, 211 HTTP tests across six suites, and 240 PostgreSQL tests across six
integration suites. Frontend formatting/lint/type checking, all 765 tests across
89 files, and the production build pass. Dedicated coverage includes request normalization, roles,
tenant/branch access, lifecycle, precise prices, bounded writes, actor attribution,
and retry conflicts. Actual PostgreSQL 17 verification exercises migration
constraints, failed movement rollback, concurrent receipts and withdrawals,
simultaneous duplicate commands, overflow retries, independent placements, and
ledger/balance reconciliation. Test setup uses explicit disposable database URLs
and random isolated schemas, never application database resets. See
[backend test setup](../../backend/test/README.md). Expanded frontend API/component
coverage and regressions pass (236 tests total), along with typecheck, lint,
formatting, and production build. Coverage includes scoped contracts, candidates,
filters, placement/price forms, request errors, history, historical-replay refresh,
failed-refresh read retry, pending write exclusion, and role-aware data denial.
Rendered status badges, filters, threshold forms, branch health cards, responsive
layout, keyboard/focus behavior, non-color communication and 200% zoom QA were
explicitly waived September 16, 2026. Those checks were not performed, and
automated tests do not certify rendered behavior or accessibility.

## Workspace UI

Inventory is now an organization sidebar/mobile destination for owners, managers
and merchants, never cashiers. `/app/organizations/:organizationId/inventory`
reuses the shared POS/Inventory/Reports branch only after its own accessible branch
lookup validates it. Without a remembered choice, it requires explicit selection,
even with one accessible branch. An unavailable choice shows access feedback and
the picker, without a different-branch fallback or erasing another feature's choice.
The labeled
branch dropdown also appears in inventory directories and placement details.
Options reuse existing authorized general branch reads: tenant branches for owners,
assigned branches for managers and assignment/own-placement-accessible branches for
merchants. Merchant historical-sales branch lookup is not used or widened.
Inventory directory/detail routes mark Inventory, not Branches, as active.

Normal Back to branch is removed; detail-to-inventory navigation and existing
branch/product shortcuts remain. Branch changes open the chosen directory, clear
old filters/placement data/form drafts and invalidate previous reads. Unsaved
inventory forms require confirmation; cancellation retains the current branch and
inputs. Pending placement/price/stock writes disable branch switching. User changes
also reset scoped inventory state. Missing current-branch access or denied branch
reads clear data and controls; old in-flight reads cannot restore cleared data.
Branch selection includes loading, empty/unassigned and retryable failed-read states.

Authorized explicit inventory branch URLs override the remembered choice. Inventory
directory/detail dropdown changes also update the shared workspace branch after
existing write/unsaved-edit and POS/refund navigation guards permit them. Cancellation
preserves the remembered branch and edits. Organization/user/role changes clear
selection; same-role access refresh revalidates it. This remembers only branch
identity in memory, not filters or opening-stock defaults. Merchant historical
Reports access never grants Inventory access. No inventory API/schema changes are
included in this navigation refinement. Frontend checks pass with 702 tests across
83 files; new rendered navigation/dropdown/focus QA remains pending final delivery.

Final shared-branch regressions pass changed-file formatting, lint/type checking,
all 702 frontend tests and production build, including cancelled form switching
and pending write guards. No backend/database changes or tests are included in
this refinement. The user explicitly waived rendered page-switching/dropdown/
keyboard/focus QA for shared branch selection on September 14, 2026. These browser
checks were not performed; automated tests do not certify rendered behavior.
This new waiver is independent of earlier Inventory/refund waivers. Both delivery
parts were reviewed and approved; the
[completed shared branch-selection plan](../plans/archive/shared-branch-selection-2026-09-14.md)
is archived.

The Products create API optionally creates one branch placement and balanced opening
RECEIPT atomically with a new product; see [Products](products.md). The frontend
new-product form offers this owner-only optional section with explicit branch
selection. Add product placement separately requires an explicit whole-unit
opening quantity and records positive stock as a placement receipt.
Frontend lint, type checking, production build, changed-file formatting and all
443 tests across 69 files pass. Unrelated existing inventory-api.ts formatting is
preserved. Rendered navigation/dropdown/keyboard/zoom QA was pending at Part 1
delivery. The user subsequently
waived rendered responsive, keyboard/dialog and zoom QA for this milestone on
September 14, 2026; automated tests do not certify those rendered behaviors.

Frontend inventory views match backend enforcement: owners/managers retain stock
controls in accessible branches, while merchants see own placements/history only.
Role/organization/branch/placement changes reset screen state and obsolete reads
are ignored. A 403/404 stock/price response clears placement data and controls,
offering read retry and owner-access guidance without replaying the denied command.
Explicit merchant branch assignments with no own products return empty inventory;
assignments never expose another merchant's stock. OpenAPI describes reduced history
responses as well as full owner/manager responses.

```text
/app/organizations/:organizationId/branches/:branchId/inventory
/app/organizations/:organizationId/branches/:branchId/inventory/:inventoryId
```

- Owner/manager branch details link to inventory; merchant branch details link to
  own inventory. Product placements link directly to their scoped inventory details.
  Cashier members see no inventory action and direct screens request no inventory.
- Merchants receive no placement, price, receipt, or correction forms. Their
  matching counts explicitly describe own placements, never branch-wide totals;
  empty assigned branches explain that assignments cannot expose others' stock.
- The directory includes debounced product search, merchant/product-status filters,
  responsive divided rows, exact PHP prices, and whole-unit balances. It loads
  50 placements initially and offers a Load more control while a next page is
  available. Counts say displayed rows when more pages remain. Filter, branch,
  role, access and successful-write changes discard prior pages and cursors;
  late responses cannot restore stale rows. Empty, filtered-empty, loading,
  and retryable first/later-page errors have distinct feedback.
- Owner/manager rows expose Receive stock and Correct stock quick actions in
  focused dialogs; the product identity still links to full placement details.
  These dialogs reuse the stock forms' live validation, receipt idempotency,
  correction confirmation, pending-write exclusion and access-loss handling.
  Success closes the dialog and refreshes authoritative branch inventory.
  Merchants remain read-only and receive no row mutation actions.
- Placement creation uses the shared scroll-contained native dialog, with focus
  restoration and pending dismissal protection. One searchable product combobox
  performs both filtering and selection. It now reads bounded branch-scoped
  eligible-product pages instead of fetching all products, merchants and branch
  placements. Search remains debounced; Load more exposes later candidates and
  stale responses are ignored. The backend offers active products of active
  merchants, excludes existing placements and preserves manager visibility.
  Creation requires product, price, threshold and whole-unit opening stock. A
  positive opening quantity is written as an attributed RECEIPT in the same
  transaction as the placement; an explicit zero creates the empty balance
  without a movement. A concurrent duplicate still returns the backend conflict
  without losing the draft.
- Price remains separate; receiving and correction panels appear side by side at
  suitable widths and stack on smaller screens. Adjustment forms offer common
  reason actions plus an editable custom reason field; receipt forms only ask for
  quantity and use the system reason `Stock received`. Input validation runs
  after 300 ms, immediately on blur, and on submit.
  Invalid submissions focus the first invalid field; errors preserve input.
- Price remains a decimal string through validation, JSON, and display. Changing
  one branch price never writes a quantity or another branch's placement.
- Receiving requires active product/merchant state. Corrections remain available
  for inactive records and confirm a signed delta, reason, and estimated result.
  Estimates do not authorize or reject commands; the backend checks current stock.
- Pending commands disable repeat activation, their inputs, and other placement
  write controls. Adjustments also protect against duplicate confirmation requests.
- Within a stock form, unchanged retries reuse the UUID from a failed command.
  Editing quantity/reason starts a new command; confirmed success clears the draft.
- Every successful stock command reloads actual inventory and movement history.
  A replayed historical balance is not treated as current stock. Failed refreshes
  hide stale write controls and offer a read-only retry, without replaying success.
- History displays immutable operation, signed delta, resulting balance, reason,
  and timestamp. Owner/manager history also shows actor ID; merchant runtime
  schemas accept actor-free responses and strip actor fields defensively.
- Runtime schemas validate branch identity, inventory/product/merchant summaries,
  exact price strings, integer bounds, and movement type/delta before rendering.
