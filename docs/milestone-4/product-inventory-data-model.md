# Product and Inventory Data Model

## Implemented schema

### `Product`

| Field | Purpose |
| --- | --- |
| `organizationId` | Tenant owner |
| `merchantId` | Merchant that owns the product |
| `name` | Product display name |
| `sku` | Required organization-scoped stock code |
| `barcode` | Optional organization-scoped barcode |
| `sellingPrice` | Current selling price using exact decimal storage |
| `status` | `ACTIVE` or `INACTIVE` |

The schema enforces tenant-safe merchant ownership with a composite foreign key. SKU and non-null barcode values are unique within the organization, not globally across the SaaS platform.

### `Inventory`

`Inventory` stores the current quantity for a product at a branch. Its composite primary key is:

```text
productId + branchId + organizationId
```

Composite relationships to both `Product` and `Branch` ensure they belong to the same organization. Quantity starts at zero and may become negative to support later offline-sales reconciliation.

### `InventoryMovement`

Each movement belongs to the same product, branch, organization, and inventory row. It stores:

- a signed, nonzero `quantityChange`;
- a `STOCK_IN` or `ADJUSTMENT` type;
- the user responsible for the change;
- an optional external or domain `referenceId`;
- an optional explanatory note; and
- the creation timestamp.

Movement records have no update timestamp because they are intended to remain immutable audit entries.

## Database protections

The migration adds:

- composite tenant-safe foreign keys;
- a positive selling-price check constraint;
- a nonzero movement check constraint;
- organization-scoped SKU and barcode uniqueness;
- branch/product/time indexes for inventory and movement queries; and
- restrictive deletion behavior to preserve inventory history.

## Application rules reserved for the API parts

The Prisma schema cannot express every contextual rule. Upcoming Milestone 4 API work must enforce:

- authenticated organization access and allowed roles;
- merchant participation in the selected branch before stock is recorded;
- normalized and bounded product input;
- positive stock-in quantities;
- required explanations for adjustments; and
- atomic quantity and movement updates.

No API routes or frontend behavior are included in this part.

