# Products and Branch Inventory Implementation Plan

**Status:** Approved; Parts 1–6 committed; Part 7 automated coverage reviewed and approved; visual QA pending
**Date:** September 12, 2026

## Goal

Allow owners and managers to maintain merchant-owned product identities and
independently manage each branch's selling price and quantity-tracked stock.
This establishes inventory foundations only, not checkout or financial behavior.

## Confirmed business decisions

- Each product belongs to exactly one merchant.
- Stock is tracked separately for each product/branch combination.
- The same product may be placed in multiple branches by business agreement.
  Recording placement in another branch does not move or deduct existing stock.
- All products are quantity-tracked.
- Each branch may set a different selling price for the same product.
- Merchant/owner agreements remain outside the application for this version.

## Approved defaults

- Prices use PHP only, have two decimal places, and must be greater than zero.
  Currency conversion, tax configuration, and multi-currency support are excluded.
- Quantities are whole units; fractional quantities are excluded.
- Stock cannot become negative.
- Product merchant ownership is fixed after creation. Reassignment is excluded
  to avoid attributing existing inventory history to a different merchant.
- Optional SKU and barcode are independently unique within the organization.
- Only owners and managers can read or manage these modules. Merchant profiles
  are not linked to user accounts, so merchant self-service is not introduced.
- Product lifecycle is `ACTIVE` or `INACTIVE`; no deletion operation is provided.
- New products, branch placements, and receipts require an active merchant and
  active product where applicable. Profile/price edits and corrective adjustments
  remain available for existing records even when a merchant or product is inactive.
- Merchant status changes do not automatically modify products, prices, stock,
  or movement history.

These defaults were approved with this plan on September 12, 2026.

## Scope and dependencies

Depends on existing authentication, organization membership guards, merchant
profiles, branches, Prisma/PostgreSQL, and the shared frontend controls.

- Create, list/search/filter, retrieve, and edit product profiles.
- Change product lifecycle status through a separate endpoint and confirmed UI.
- Create one inventory placement per product/branch, initially with zero stock
  and an explicitly supplied branch selling price.
- List branch inventory and inspect an individual product placement.
- Edit branch selling price without changing quantity.
- Receive stock and make signed manual stock adjustments with required reasons.
- Display immutable stock movement history for each placement.
- Add owner/manager product and branch inventory workspace flows.
- Cover validation, authorization, tenant and branch isolation, precision,
  concurrency, retry safety, and complete workflows with tests.
- Add representative records to the disposable development seed.
- Document implemented behavior only after delivery and verification.

## Explicit exclusions

POS, sales, checkout, carts, refunds, reservations, stock transfers, purchasing,
supplier management, cost prices, profit reporting, tax/discount calculations,
commercial agreements, commissions, settlements, payouts, merchant login,
membership linkage, branch-specific permissions, product variants, categories,
images, attachments, bundles, fractional units, import/export, deletion,
low-stock alerts, global audit infrastructure, queues, and new infrastructure.

No placeholder entities, fields, routes, or abstractions for these exclusions.

## Data model

### Product

```text
id             UUID-formatted identifier, primary key
organizationId required tenant identifier
merchantId     required; immutable after creation
name           required
sku            optional
barcode        optional
status         ACTIVE | INACTIVE; defaults to ACTIVE
createdAt
updatedAt
```

- Organization has many products; merchant has many products.
- Names are not unique.
- Add unique keys `(organizationId, sku)`, `(organizationId, barcode)`, and
  `(id, organizationId)`; null SKU/barcode values may occur on multiple products.
- Add index `(organizationId, merchantId, status)` and
  `(organizationId, name)` for directory queries.
- Merchant relation uses `(merchantId, organizationId)` referencing
  `(id, organizationId)` to prevent cross-tenant ownership at the database layer.
- Organization and merchant relations use restrictive deletion behavior.

### BranchInventory

```text
id             UUID-formatted identifier, primary key
organizationId required tenant identifier
branchId       required
productId      required
sellingPrice   Decimal/Numeric(12, 2), required
quantity       integer, defaults to zero
createdAt
updatedAt
```

- Unique `(organizationId, branchId, productId)` ensures one placement per branch.
- Add unique `(id, organizationId, branchId)` for scoped movement relations.
- Add index `(organizationId, productId)` for product placement queries.
- Branch and product foreign keys include `organizationId`; add the minimal
  `(id, organizationId)` unique key to existing `Branch` to support this relation.
- Database checks enforce `quantity >= 0` and `sellingPrice > 0`.
- Relations use restrictive deletion behavior; no placement deletion is exposed.
- Product has no global selling price or global stock quantity.

### InventoryMovement

```text
id                UUID-formatted identifier, primary key
organizationId    required tenant identifier
branchId          required
branchInventoryId required
type              RECEIPT | ADJUSTMENT
quantityChange    signed integer; never zero
quantityAfter     nonnegative integer snapshot
reason            required
createdById       authenticated user identifier
requestId         client-generated UUID for retry safety
createdAt
```

- Composite inventory foreign key includes organization and branch identifiers.
- Actor references the existing user with restrictive deletion behavior, not
  membership: removing membership must not erase historical attribution.
- Unique `(organizationId, requestId)` makes stock commands retry-safe.
- Index `(organizationId, branchId, branchInventoryId, createdAt, id)` supports
  movement history ordered newest first, then ID for deterministic ties.
- Database checks enforce nonzero deltas, positive receipt deltas, and
  nonnegative `quantityAfter`.
- No update/delete movement endpoint and no fictitious zero opening movement.
- Keep identifier storage compatible with the existing Prisma schema; do not
  convert existing text-backed UUID identifiers to native UUID columns.

## Validation and business rules

- Product name: trimmed, 2–120 characters.
- SKU: optional, trimmed/uppercased, 2–32 characters; letters, numbers, and
  internal hyphens only. Blank/null update clears it.
- Barcode: optional, trimmed, 1–64 ASCII letters/numbers/hyphens, case-sensitive;
  preserve leading zeroes. No barcode symbology or checksum validation is added.
  Blank/null update clears it.
- Merchant, branch, product, inventory, and request IDs must be UUID v4.
- Create product accepts no status or organization ID; profile update accepts
  no merchant ID or status and rejects an empty body.
- Price is a decimal string, not a JSON floating-point number. Accept at most
  two fractional digits, no scientific notation, up to `9999999999.99`, and
  normalize responses to exactly two decimal places. Use Prisma Decimal on the
  server; do not calculate or store money through JavaScript floating-point.
- Placement create accepts only product ID and selling price; quantity starts
  at zero. Opening stock is entered through a separate receipt.
- Receipt accepts positive integer `quantity`, reason, and request ID.
- Adjustment accepts nonzero signed integer `quantityChange`, reason, and
  request ID. It is a delta, not replacement of the current total.
- Reason: trimmed, 2–500 characters.
- Validate integer deltas and resulting totals against PostgreSQL integer bounds.
- No profile or price endpoint accepts a stock quantity.
- Duplicate identifiers/placements return `409`; invalid values return `400`.
  Stock underflow/overflow and lifecycle conflicts return descriptive `409` errors.
- Related foreign-tenant objects use the same `404` behavior as absent objects.
- DTO whitelisting rejects all unknown fields.

## Transactions, concurrency, and retry safety

- Quantity update and movement insertion occur in one database transaction.
- Never read a quantity and later write an unprotected absolute replacement.
  Use a conditional atomic increment on the tenant/branch-scoped inventory row,
  including lower/upper bounds, then record the resulting quantity.
- Failed movement insertion rolls back the quantity change.
- Repeating a request ID with the same inventory, operation, delta, and reason
  returns the original movement without changing stock again. A reused request
  ID with different content returns `409` without disclosing another tenant.
- Simultaneous duplicate requests must produce one movement and one stock change;
  handle uniqueness conflicts by resolving the committed original command.
- Frontend disables pending write controls and reuses the same request ID for
  retries of the same command; changed command content receives a new ID.
- No transfer side effects: creating or receiving another placement never writes
  to the original branch's inventory.

## API

Every route uses `AuthGuard`, `OrganizationAccessGuard`, and `OWNER`/`MANAGER`
roles. Organization context is trusted only after membership authorization.

```text
POST  /organizations/:organizationId/products
GET   /organizations/:organizationId/products?q=&merchantId=&status=
GET   /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId/status
GET   /organizations/:organizationId/products/:productId/inventory

POST  /organizations/:organizationId/branches/:branchId/inventory
GET   /organizations/:organizationId/branches/:branchId/inventory?q=&merchantId=&status=
GET   /organizations/:organizationId/branches/:branchId/inventory/:inventoryId
PATCH /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/price
POST  /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/receipts
POST  /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/adjustments
GET   /organizations/:organizationId/branches/:branchId/inventory/:inventoryId/movements
```

- Directories search product name/SKU/barcode; name/SKU search is case-insensitive,
  barcode search preserves case. Filters apply merchant and product lifecycle.
- Product and branch inventory lists order by product name then stable ID.
- Return complete filtered lists in this first version; no speculative pagination.
- Product placement list includes branch identity, quantity, and branch price.
- Movement responses include operation, delta, quantity after, reason, timestamp,
  and actor ID. No deleted user's personal data is returned.
- Receipt/adjustment returns the saved movement; frontend reloads current inventory
  after success because a replayed movement snapshot is not necessarily current stock.
- Update OpenAPI request/response contracts, including decimal-string prices.
- Keep controllers thin and product/inventory services focused; reuse existing
  guards without a new generic repository or permissions framework.

## Frontend

```text
/app/organizations/:organizationId/products
/app/organizations/:organizationId/products/:productId
/app/organizations/:organizationId/branches/:branchId/inventory
/app/organizations/:organizationId/branches/:branchId/inventory/:inventoryId
```

- Add Products navigation only for owners/managers; expose Inventory from branch
  detail and product placement links rather than inventing another branch context.
- Product directory includes debounced search, merchant/status filters, responsive
  rows, and creation in the shared scroll-contained native dialog.
- Product profile supports edits and a separately confirmed lifecycle change.
- Show independently priced/stored branch placements on product detail.
- Branch inventory provides product placement creation, scoped product search,
  merchant/status filters, quantities, and PHP prices.
- Inventory detail separates price editing, receiving, adjustments, and movement
  history. Adjustment confirmation shows signed delta and estimated resulting
  stock; server remains authoritative if another command changes the stock.
- Reuse warm stone/graphite controls and current modal behavior from `DESIGN.md`.
- Forms validate on each input with a 300 ms debounce, immediately on blur, and
  finally on submit. Provide visible loading, empty, error, pending, and success
  states, focus restoration, safe modal dismissal, and bounded dropdowns.
- Mirror backend schemas and validate API responses before rendering them.
- Do not show navigation/actions to cashier or merchant-role members; backend
  enforcement remains the actual security boundary.

## Testing and verification

Backend unit and HTTP end-to-end coverage includes normalization, lifecycle
rules, owner/manager access, cashier/merchant denial, unauthenticated requests,
malformed IDs, unknown fields, tenant/branch isolation, scoped uniqueness,
decimal-string validation, independent branch prices/quantities, and workflows.

Database-backed integration tests against an explicitly disposable test database
must verify composite foreign keys, check constraints, rollback, concurrent
receipts/adjustments, underflow/overflow, simultaneous duplicate commands, and
movement/balance reconciliation. Mocked Prisma tests alone cannot establish
database concurrency correctness. Never reset a developer or production database
implicitly; request permission before destructive test setup where necessary.

Frontend tests cover APIs, response schemas, live validation, filters, role-aware
visibility, dialogs, placement creation, independent prices, stock commands,
retry behavior, confirmation, movement history, and request-state feedback.

Run Prisma format/validation/generation, backend formatting/lint/build/unit/HTTP
e2e/database integration checks, and frontend formatting/lint/typecheck/build/tests.
Verify dialogs, input alignment, dropdown containment, keyboard behavior, and
responsive layouts visually. Do not inherit the prior refactor's QA waiver.

## Delivery parts and review checkpoints

1. Product/placement/movement schema, migration, generated client, and seed.
2. Product backend DTOs, service, controller, module wiring, and OpenAPI contract.
3. Branch inventory/price/stock/movement backend and transactional retry safety.
4. Backend unit, HTTP e2e, and database-backed integrity/concurrency coverage.
5. Product frontend directory, dialog, profile, lifecycle, and placement display.
6. Branch inventory frontend, placement/price forms, stock commands, and history.
7. Frontend coverage and visual/accessibility verification.
8. Full verification; module documentation updates and completed plan archive.

Implement one part at a time. Stop for user review after each part. Only after
approval, commit that part's scoped changes and proceed to the next part.
Preserve unrelated changes; do not commit them with this work.

## Definition of done and approval boundary

- Confirmed decisions and approved defaults are enforced without excluded behavior.
- One merchant per product and independent branch price/stock are preserved.
- Tenant/branch relationships are protected by queries and database constraints.
- Every stock change has an immutable, attributed movement and retry-safe command.
- Concurrency cannot produce negative stock, lost updates, or duplicate commands.
- Applicable automated checks and explicit visual verification pass.
- `docs/modules/products.md` and `docs/modules/branch-inventory.md` describe the
  implemented behavior; affected merchant/branch docs reflect integration points.
- Archive this plan only after implementation and verification.

The user approved this plan and instructed implementation on September 12, 2026.
Continue only through the per-part review and commit checkpoints above.

## Part 1 verification record

- Added product, branch inventory, and inventory movement persistence models.
- Added composite tenant/branch foreign keys, unique keys, and query indexes.
- Added migration checks for prices, stock balances, and movement deltas.
- Added demo products and independently priced branch placements. Seeded opening
  receipts and a corrective adjustment atomically with their stock changes.
- Prisma formatting/validation/generation, backend build/lint, and all 85 existing
  unit tests passed.
- Migration SQL was compared with Prisma's generated schema SQL. No migration
  or destructive seed reset was run against an existing database. Database-backed
  constraint and concurrency verification remains required in Part 4.
- No API, UI, stock-command service, or excluded feature was implemented.

## Part 2 verification record

- Part 1 was reviewed and committed as `582cf58`.
- Added product creation, listing/search/filtering, retrieval, profile editing,
  lifecycle changes, and read-only branch placement listing.
- Every route requires owner/manager organization access. Related merchants and
  products are resolved within the trusted tenant; foreign IDs return not found.
- Create requires an active merchant. Profile edits reject empty bodies and
  cannot reassign ownership or set lifecycle status.
- SKU normalization and barcode case/leading zeroes are preserved. Duplicate
  organization-scoped identifiers map to conflict responses.
- Placement responses use exact two-decimal price strings, not floating-point.
- Backend formatting/lint/build and 85 existing regression unit tests passed.
  Product-specific unit/HTTP coverage remains Part 4.
- No stock mutations or frontend behavior was added.

## Part 3 verification record

- Part 2 was reviewed and committed as `cca32c1`.
- Added tenant/branch-scoped placement creation/listing/retrieval, price changes,
  stock receipts, corrective adjustments, and immutable history endpoints.
- Added decimal-string price validation, signed integer bounds, required reasons,
  active lifecycle checks, and authenticated actor attribution.
- Bounded atomic stock increments and movement insertion share a read-committed
  transaction. Request-ID replay and concurrent uniqueness/range conflict
  resolution avoid duplicate stock changes.
- Updated OpenAPI contracts and module documentation with delivered backend scope.
- Backend formatting/lint/build and 85 existing regression tests passed.
- Dedicated stock/authorization tests and actual PostgreSQL rollback/concurrency
  verification remain Part 4. No existing database migration/reset was run.
- No frontend or excluded workflow was implemented.

## Part 4 verification record

- Part 3 was reviewed and committed as `baa37db`.
- Added product/price/stock DTO tests and product, placement, and stock service
  tests for normalization, lifecycle, scoped access, precise prices, bounded
  increments, actor attribution, and retry/conflict handling.
- Added HTTP coverage for every product/inventory route's authentication and
  role boundary, malformed IDs, unknown fields, trusted context, and price input.
- Added explicit `TEST_DATABASE_URL` integration setup with random schemas and
  repository migrations, without application URL fallback or database resets.
- Actual PostgreSQL 17 tests pass for tenant/branch composite foreign keys,
  scoped uniqueness, price/quantity/movement checks, failed-write rollback,
  concurrent receipts/withdrawals, simultaneous duplicates (including overflow),
  lifecycle/profile/history workflows, and ledger/balance reconciliation.
- Unit tests, HTTP e2e tests, PostgreSQL integration tests, formatting, lint,
  and backend build pass. See module docs for check totals and test setup.
- Only a disposable Docker test database was used; no application data was reset
  or migrated. No frontend or excluded workflow was added.

## Part 5 verification record

- Part 4 was reviewed and committed as `a40a4aa`.
- Added owner/manager Products navigation, thin directory/profile routes, typed
  API calls, and runtime response validation.
- Added debounced directory search, merchant/status filters, responsive rows,
  creation in a scroll-contained native dialog, and request-state feedback.
- Product profile supports identity edits with fixed merchant ownership and
  separately confirmed lifecycle changes. Forms validate on input after 300 ms,
  immediately on blur, and on submit; pending writes disable fields and dismissal.
- Product details display independent branch quantities and exact PHP price
  strings. Placement links go to implemented branch details for now; inventory
  detail links and stock/price/placement mutations remain Part 6.
- Added focused normalization, response precision, live validation, pending,
  optional-clearing, empty-merchant, and navigation tests. Broader frontend
  workflow coverage and explicit rendered QA remain Part 7; no prior QA waiver
  applies to these screens.
- Frontend tests, type checking, lint, changed-source formatting, production
  build, and diff checks were run. No backend/database change or excluded
  behavior was added.

## Part 6 verification record

- Part 5 was reviewed and committed as `8cf4853`.
- Added owner/manager branch inventory directory/detail routes and branch/product
  links, scoped API calls, and runtime branch/inventory/movement response schemas.
- Directory supports debounced product search, merchant/product-status filters,
  independently displayed price/quantity, loading, retryable errors, and empty states.
- Placement creation uses the shared native dialog and searchable active products
  of active merchants, excluding products already placed in this branch. Placement
  starts at zero with an explicit decimal-string PHP price and no transfer effects.
- Added separate live-validated branch price, receiving, and correction forms.
  Corrections require confirmation of signed delta, reason, and estimated result;
  the server remains authoritative over current stock and lifecycle.
- Unchanged failed stock commands retain their request IDs; editing command input
  assigns a new ID on submission. Pending controls prevent repeat/concurrent writes.
- Successful commands refresh current inventory and immutable movement history.
  A refresh error hides stale write controls and offers read retry without replaying
  the successful stock command. Movement snapshots never replace current stock.
- Added focused price/quantity/schema, debounce/blur, retry identity, correction
  confirmation, and inactive-receiving coverage. Frontend tests (191), typecheck,
  lint, changed-source formatting, build, and diff checks pass.
- Expanded frontend workflow coverage and explicit rendered visual/accessibility
  verification remain Part 7. No prior QA waiver applies. No backend/database
  changes, transfers, checkout, or excluded behavior were added.

## Part 7 verification record and remaining boundary

- The user reviewed and approved the automated coverage for commit. Visual QA
  remains a separate unmet requirement; Part 7 is not marked complete.
- Part 6 was reviewed and committed as `9477f2e`.
- Added product/inventory API tests for scoped paths, query encoding, separate
  profile/status/placement/price/stock contracts, precise prices, request IDs, and
  rejection of malformed inventory/movement responses.
- Added product directory/profile workflow coverage for debounced search and
  filters, creation/editing dialogs, normalization, success/reload, read retry,
  superseded responses, confirmed/cancelled lifecycle changes, independent branch
  placement displays, and cashier/merchant-role denial without data requests.
- Added inventory directory/placement/price/detail coverage for active candidates,
  exclusion of existing placements, scoped search/filters/links, exact prices,
  creation/conflict input preservation, live validation, immutable history,
  actual-stock refresh after historical replay, stale-control suppression after
  refresh failure, read-only retry, and pending concurrent-write prevention.
- Added shared form-dialog accessible context, initial/restored focus, scroll
  restoration, and pending Escape/backdrop protection tests. Test-only jsdom
  dialog shims model open/close, not browser layout, top layer, or native focus trap.
- All 236 frontend tests, typecheck, lint, changed-source formatting, production
  build, and diff checks pass. No business/API/database behavior was changed.
- Visual QA could not run: browser inventory has no enabled browsers, and opening
  an in-app browser returned `Browser is not available: iab`. The user declined
  enabling a browser. This is not an explicit waiver of visual verification.
- Part 7 is not complete and this plan must not be archived as fully verified.
  Review of the automated changes does not implicitly waive the remaining QA.

### Pending rendered checklist

With a browser and a disposable seeded environment, verify product directory,
creation/editing dialogs, product detail/placements, inventory directory,
placement dialog, and price/receipt/adjustment/history detail screens:

- 320/768/1024/1440-pixel layouts and 200% zoom: no overlapping controls, clipped
  labels/errors, inconsistent field sizing, or unintended horizontal overflow.
- Long names, barcodes, actor IDs, and reasons wrap without hiding actions.
- Native modal heading focus, background blocking, Tab/Shift+Tab containment,
  safe Escape/backdrop dismissal, pending protection, and trigger restoration.
- Merchant/product choice menus remain inside available viewport/dialog space;
  arrows/Home/End/Enter/Space/Tab/Escape work without scrolling the entire modal.
- Live errors appear after 300 ms and immediately on blur, clear on correction,
  and link to inputs; loading/error/empty/success feedback remains understandable.
- Adjustment confirmation states signed delta/estimate, focuses the safe action,
  and restores focus; pending writes do not permit another command.
- Visible keyboard focus, rendered contrast, reduced-motion behavior, and clear
  role-aware navigation/actions. No production data should be changed for QA.
