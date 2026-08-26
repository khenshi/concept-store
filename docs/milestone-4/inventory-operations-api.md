# Inventory Operations API

## Scope

This part adds authenticated stock-in and inventory-adjustment operations. Each operation updates the current branch quantity and appends an audit movement in one database transaction.

Inventory browsing and movement-history endpoints are reserved for the next part.

## Endpoints

Both routes require an access token and an `OWNER` or `MANAGER` organization role.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/organizations/:organizationId/inventory/stock-in` | Add received stock to a branch |
| `POST` | `/organizations/:organizationId/inventory/adjustments` | Apply an explained quantity correction |

Both responses contain the updated `inventory` record and the newly created `movement` record.

## Stock-in

Stock-in accepts:

- `productId`
- `branchId`
- a positive integer `quantity`
- optional `referenceId`
- optional `note`

The operation creates the branch inventory row when it does not yet exist. Otherwise, it atomically increments the existing quantity. An inactive product cannot receive new stock.

## Adjustments

An adjustment accepts:

- `productId`
- `branchId`
- a positive or negative, nonzero integer `quantityChange`
- a required, non-empty `note`
- optional `referenceId`

Adjustments require an existing inventory row. They may reduce quantity below zero so discrepancies remain visible and can be reconciled. Inactive products may still be adjusted because their remaining physical stock may require correction.

## Security and consistency

- Organization scope comes from the authenticated membership context.
- Product and branch records must belong to that organization.
- The product's merchant must currently operate in the target branch.
- The authenticated user ID is saved as `createdById`; callers cannot provide it.
- Quantity and movement writes use a serializable transaction and succeed or fail together.
- Concurrent write conflicts return `409` with instructions to retry.
- Cross-organization product and branch identifiers return `404` without exposing tenant data.

## Audit behavior

Stock-in creates a `STOCK_IN` movement. Corrections create an `ADJUSTMENT` movement. Movement values are signed and nonzero, and movements are append-only records rather than editable quantity notes.

Reference IDs are informational in this milestone and are not idempotency keys. Idempotent transaction handling will be designed for the offline POS milestone.

## Explicit exclusions

This part does not implement inventory lists, movement-history queries, product sales, returns, damaged-stock workflows, purchasing, or offline synchronization.

