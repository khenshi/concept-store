# Milestone 4 — Products and Inventory

**Status:** Completed historical summary

## Goal

Replace spreadsheet inventory tracking with tenant-safe product records,
branch-level quantities, and an auditable movement history.

## Delivered

- Merchant-owned products with SKU, optional barcode, price, and status.
- Organization-scoped SKU and barcode uniqueness.
- Branch inventory records keyed by product, branch, and organization.
- Stock-in operations and signed inventory adjustments.
- Immutable movement records with actor, note, reference, and timestamp.
- Filtered current inventory and cursor-based movement history APIs.
- Owner/manager product, inventory, stock-in, adjustment, and history UI.

## Important rules

- Product prices use decimal storage and must be positive.
- Inventory operations require a valid tenant product and branch.
- The merchant must participate in the target branch.
- Every quantity mutation creates a matching movement in the same transaction.
- Adjustments may create negative quantities when reflecting a physical count;
  the movement history remains the explanation.
- Product deactivation preserves existing inventory and history.

## Security and integrity result

Clients cannot choose an arbitrary organization or movement actor. Composite
foreign keys protect tenant relationships, and serializable operations prevent
lost concurrent inventory changes.

## Explicit exclusions at completion

Warehouses, suppliers, purchasing, variants, transfers, POS deductions, and
merchant self-service inventory were deferred.

## Current reference

- [Products and inventory](../workflows/products-and-inventory.md)
