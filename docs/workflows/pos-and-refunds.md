# POS, Payments, and Refunds

**Status:** Current reference

## Sellable catalog

The POS catalog is branch-specific. A product is sellable when:

- the product is active;
- its merchant is active and participates in the branch;
- a branch inventory record exists; and
- stock is available for the requested quantity.

The POS does not load the branch catalog on entry or branch selection. The
primary cashier workflow is entering or scanning an exact SKU/barcode to add a
product directly to the cart. Invalid, unavailable, or out-of-stock codes
produce an inline warning.

The product result list updates automatically after a brief debounce whenever a
non-empty name, SKU, or barcode search changes. Clearing the search immediately
returns to the quick-code-first empty state without making a catalog request.

## Checkout

Owners, managers, and cashiers can complete online sales. The backend:

1. verifies membership and branch scope;
2. reloads products and inventory;
3. derives merchant attribution, price, and totals;
4. validates payment totals and references;
5. creates the sale, immutable sale items, and payments;
6. deducts inventory conditionally; and
7. records sale inventory movements.

These writes occur atomically. A globally unique client transaction ID makes
retries idempotent.

## Payments

Supported manual methods are cash, GCash, bank transfer, and other. Non-cash
payments require a reference. The application records confirmation; it does not
integrate a payment gateway or automatically verify external transfers.

## History and receipts

Completed sales can be filtered and opened from branch sales history. Details
show the immutable item and payment snapshots. Receipts provide a print-focused
representation without changing transaction records.

## Refunds

Completed item refunds preserve the original merchant attribution and amount.
Refund creation records the actor, reason, returned quantities, and corresponding
inventory movements. Settlement calculations deduct completed refunds before
commission is calculated.

## Offline boundary

The current POS is cloud connected. Offline catalog caching, local queues,
conflict reconciliation, and sync remain Milestone 8 work.
