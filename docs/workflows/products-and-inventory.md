# Products and Inventory

**Status:** Current reference

## Products

Products belong to one organization and one merchant. The initial product model
contains name, SKU, optional barcode, selling price, and active/inactive status.

- SKU is unique within an organization.
- Barcode is unique within an organization when present.
- Selling price must be positive and uses decimal storage.
- Product ownership and tenant scope cannot be reassigned through arbitrary
  client identifiers.
- Advanced variants, purchasing, suppliers, and warehouses are not included.

## Branch inventory

Inventory is identified by organization, branch, and product. It represents the
quantity physically available in that branch.

Owners and managers can:

- stock in a positive quantity;
- apply a signed adjustment with an explanation;
- view current quantities; and
- inspect movement history.

Stock operations require the product's merchant to operate in the selected
branch.

## Audit trail

Every quantity change creates an `InventoryMovement` containing the signed
change, movement type, actor, timestamp, and optional note/reference. Sale and
refund movements also reference their source transaction.

The current quantity is optimized for operational reads; movement history
explains how it was reached. Adjustments may produce negative inventory when a
physical count requires it. POS checkout separately prevents online sales from
exceeding current available stock.

## Views and reporting

Current inventory supports branch, merchant, product, status, and search
filters. Movement history uses bounded pagination. Reporting presents current
stock and low-stock counts as present-time values, not historical period
balances.
