# Milestone 5 Completion Audit

## Status

Milestone 5 — Online POS is complete for its agreed initial scope.

The system now supports a reliable cloud-connected sale from branch product lookup through checkout, inventory deduction, transaction history, and a printable sales receipt.

## Completed workflow

```text
Authorized owner / manager / cashier
  → Select branch
  → Search or scan active sellable products
  → Build stock-bounded cart
  → Choose manual payment method
  → Submit idempotent online checkout
  → Backend recalculates and atomically records sale
  → Branch inventory is deducted with movement history
  → Show completed transaction and sales receipt
  → Review branch sales history and immutable details
```

## Backend completion

- branch-scoped sellable product search and exact SKU/barcode lookup;
- server-authoritative prices, merchant attribution, totals, and access checks;
- precise decimal calculations;
- atomic sale items, payments, inventory deductions, and `SALE` movements;
- idempotency through organization-unique client transaction IDs;
- manual `CASH`, `GCASH`, `BANK_TRANSFER`, and `OTHER` payments;
- non-cash payment reference validation;
- tenant- and branch-scoped sales history and transaction details;
- immutable historical product, merchant, price, cashier, and payment data; and
- Swagger contracts and backend unit/e2e coverage.

## Frontend completion

- role-appropriate POS navigation for owners, managers, and cashiers;
- branch-specific catalog and stock visibility;
- name, SKU, and barcode product lookup;
- responsive cart with stock-bounded quantities;
- unified manual-payment modal and validation;
- stable retry identifier while an uncertain checkout is retried;
- completed-sale state and refreshed online inventory;
- branch sales history with filters and pagination;
- immutable transaction details; and
- clean browser-printable sales receipts.

## Verified invariants

- organization and branch context are never derived solely from client claims;
- merchant users cannot use staff POS endpoints;
- a cart cannot silently mix products from multiple branches;
- client prices, merchant IDs, and totals are not accepted as authoritative;
- inventory cannot be partially deducted for a failed online checkout;
- retrying a completed request cannot create a duplicate sale;
- completed transactions are presented as read-only history; and
- receipt data comes from stored sale snapshots rather than mutable catalog data.

## Deliberately deferred

- discounts and promotions;
- split payments;
- cash tendered and change-due calculation;
- returns, refunds, cancellations, and voids;
- external payment gateway integrations;
- tax-accredited or official-receipt behavior;
- PDF/email receipt delivery;
- sales reporting and dashboards;
- settlement and payout calculation; and
- offline POS persistence and synchronization.

These are not defects in Milestone 5. They require later roadmap milestones or separately approved business rules.

## Next milestone boundary

The next roadmap milestone is **Milestone 6 — Merchant Finance**. It should begin with a separate design and scope review for settlement periods, agreement snapshots, commission and rent calculations, adjustments, approval lifecycle, and payout recording. No Milestone 6 behavior is included here.
