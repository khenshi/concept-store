# Milestone 5 — Online POS

**Status:** Completed historical summary

## Goal

Complete reliable cloud-connected sales with merchant attribution, manual
payments, inventory deduction, history, and receipts.

## Delivered

- Branch-specific sellable product catalog and exact SKU/barcode lookup.
- Cart and server-authoritative checkout.
- Cash, GCash, bank transfer, and other manual payment recording.
- Immutable sale-item snapshots with merchant attribution.
- Atomic inventory deduction and sale movement creation.
- Idempotent checkout through client transaction IDs.
- Branch sales history, transaction detail, and printable receipts.
- Quick SKU/barcode cart entry for cashiers.
- Completed item refunds and returned-stock movements were added with the
  revised finance workflow.

## Important rules

- Products and merchants must be active and assigned to the selling branch.
- The backend reloads price, merchant, and stock information at checkout.
- Payment totals must exactly equal the server-calculated sale total.
- Non-cash methods require a reference.
- One sale may contain items from several merchants.
- Checkout, payments, inventory deduction, and movement creation are atomic.
- Retrying a completed client transaction does not create a duplicate sale.

## Security and integrity result

POS access is restricted to owners, managers, and cashiers. Historical sale
meaning does not change when products are edited later. Tenant, branch, product,
merchant, price, total, and actor data are validated or derived by the backend.

## Explicit exclusions at completion

Payment gateways, automatic transfer verification, offline queues, inventory
conflict reconciliation, ecommerce, and advanced discounts were deferred.

## Current reference

- [POS, payments, and refunds](../workflows/pos-and-refunds.md)
