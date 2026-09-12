# Products and Branch Inventory Implementation Plan

**Status:** Approved; Part 1 implemented, awaiting review
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
