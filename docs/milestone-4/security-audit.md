# Milestone 4 Security Audit

## Result

Milestone 4 passes the security review for products and inventory.

## Verified controls

- Product and inventory routes require authentication, organization membership, and an owner or manager role.
- Product ownership is validated against a merchant in the same organization.
- SKU and barcode uniqueness is tenant-scoped; prices use precise decimal storage and must be positive.
- Inventory is keyed by product, branch, and organization, with composite foreign keys preventing cross-tenant combinations.
- Stock-in and adjustments verify product, branch, and merchant branch participation on the backend.
- Quantity changes and movement creation occur atomically in transactions.
- Inventory movements record the trusted authenticated actor and reject zero-value changes.
- Adjustments reject negative resulting inventory; the movement history explains every accepted quantity change.
- List/detail queries are tenant- and branch-scoped and validate pagination/filter input.

## Evidence

- Product and inventory service tests cover tenant scoping, merchant participation, negative-stock rejection, and atomic movement writes.
- Milestone 4 HTTP tests cover authentication, role enforcement, cross-tenant concealment, and DTO validation.
- Database constraints protect product price, uniqueness, inventory identity, and movement integrity.

## Residual risks

- There is no generalized approval workflow for inventory adjustments; the current owner/manager authorization matches Milestone 4 scope.
- Inventory movement records are append-only by API design, but database-level write privileges must remain limited to the application role in production.

