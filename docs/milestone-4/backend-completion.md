# Milestone 4 Backend Completion

## Result

The Milestone 4 backend is complete. It provides tenant-safe merchant-owned products, branch inventory, audited stock operations, current inventory views, and movement history.

Frontend implementation remains separate and begins only after review of this backend milestone.

## Implemented capabilities

### Products

- required merchant ownership within the same organization
- short organization-unique SKU codes
- optional organization-unique barcodes
- exact SKU or barcode lookup
- precise current selling price
- active and inactive lifecycle status
- filtering by merchant, status, and search
- immutable merchant ownership after creation

### Inventory operations

- one current quantity per product and branch
- initial inventory creation through stock-in
- positive stock-in operations
- signed, explained inventory adjustments
- append-only movement records
- authenticated actor attribution
- optional operational notes and references
- atomic quantity and movement writes
- serializable transaction isolation and concurrency conflict responses

### Inventory visibility

- current inventory filtered by branch, merchant, product, product status, or search
- product, merchant, and branch context in inventory results
- offset pagination with total count for the current snapshot
- movement history filtered by branch, product, or movement type
- product, branch, and responsible-user context in movement results
- cursor pagination for the growing audit ledger

## API surface

```text
POST  /organizations/:organizationId/products
GET   /organizations/:organizationId/products
GET   /organizations/:organizationId/products/lookup
GET   /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId/status

GET  /organizations/:organizationId/inventory
GET  /organizations/:organizationId/inventory/movements
POST /organizations/:organizationId/inventory/stock-in
POST /organizations/:organizationId/inventory/adjustments
```

All endpoints are included in the existing Swagger/OpenAPI documentation.

## Security and integrity

- Every endpoint requires authentication and a stored organization membership.
- Current product and inventory management is restricted to `OWNER` and `MANAGER`.
- Every business query is scoped by the trusted organization context.
- Composite foreign keys prevent cross-organization merchant, product, branch, and inventory relationships.
- A product can receive branch inventory only where its merchant currently operates.
- SKU and barcode uniqueness is scoped to one organization.
- Selling prices use PostgreSQL decimal storage rather than floating-point values.
- Every quantity change creates an attributed movement in the same transaction.
- Cross-tenant identifiers and movement cursors do not expose another organization's data.

## Negative inventory

Inventory quantity is intentionally allowed to become negative. This keeps legitimate future offline sales and operational discrepancies visible for reconciliation instead of silently discarding transactions. Milestone 4 does not implement offline sales.

## Merchant self-service limitation

The schema already relates merchants to products and branch inventory. Merchant users are not yet allowed to call these endpoints because an organization membership with the `MERCHANT` role is not currently linked to a specific `Merchant` record.

Merchant self-service must first add that secure account-to-merchant relationship. The backend can then derive merchant ownership from authentication and restrict queries automatically. It must never trust a merchant-supplied `merchantId` for self-access.

## Migration

Milestone 4 adds:

```text
20260826000000_add_products_and_inventory
```

Prisma validation and client generation pass. Migration status found 10 migrations and reported this Milestone 4 migration as pending on the configured database. It was intentionally not applied automatically; apply it through the normal reviewed migration workflow for the target environment.

## Explicit exclusions

Milestone 4 does not implement product variants, categories, images, suppliers, purchasing, warehouses, low-stock configuration, CSV exports, sales/POS, returns, damaged-stock workflows, merchant self-service, or offline synchronization.

## Validation

The completion check ran:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npx prisma migrate status
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run format:check
git diff --check
```

Results:

- 18 unit-test suites passed with 106 tests.
- 7 end-to-end suites passed with 49 tests.
- Build, lint, formatting, Prisma validation, and generated-client checks passed.
- Migration status connected successfully and returned the expected nonzero status because the Milestone 4 migration is not yet applied.
