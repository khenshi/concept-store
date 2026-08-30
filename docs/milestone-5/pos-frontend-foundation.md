# Milestone 5 Frontend Part 1: POS Foundation

## Scope

This part introduces the authenticated online POS workspace without completing checkout.

It includes:

- a Point of Sale destination for owners, managers, and cashiers;
- organization and branch-aware product loading;
- product-name, SKU, and barcode search;
- exact SKU/barcode lookup before broader search;
- current online stock visibility;
- local cart construction with stock-bounded quantities; and
- responsive product and current-sale panels using the established design system.

The cart is intentionally local component state in this part. It is cleared on navigation and has no offline persistence.

## Branch safety

A sale is built for exactly one branch. Once the cart contains an item, branch switching is disabled until the cart is cleared. This prevents products and inventory from different branches from being mixed silently.

## Authorization

The frontend exposes POS navigation to `OWNER`, `MANAGER`, and `CASHIER` roles. The backend remains authoritative for organization membership, role access, branch ownership, and product sellability.

## Deferred

- checkout submission;
- manual payment entry;
- completed-sale confirmation and receipt;
- sales history and transaction details;
- offline persistence and synchronization.

Checkout is implemented separately in Part 2 and uses server-calculated totals rather than trusting the displayed client total.
