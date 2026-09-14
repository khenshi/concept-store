# Refund Persistence

**Status:** Persistence foundation implemented; no refund command/read API or
frontend workflow is implemented yet.

## Implemented scope

The refund migration adds Refund and RefundItem records and the RETURN inventory
movement value. This is the first persistence part of the approved returns/manual
refund plan. Existing checkout, sale/history responses, report calculations and
inventory commands retain their current behavior. No public route creates refunds
or RETURN movements. Report refund/net figures and frontend support remain in the
current plan, not implemented behavior.

## Records and precise types

Refund references its original organization/branch/sale and actor. It stores a
completion timestamp, tenant-unique refund code and UUID request ID, trimmed
2–500 character reason, actual manual CASH/GCASH/CARD method, applicable reference,
Decimal(24,2) total and private object-shaped refundCommand. It reuses the existing
payment-method enum without tying refund method to the original payment.

Cash has no reference, tender or change fields. Noncash requires a trimmed 2–100
character reference; references are not unique or verified. Database checks reject
zero/negative/nonfinite totals, invalid codes/reasons/commands and invalid reference
combinations. Generated Prisma types retain Decimal values, not floating-point
amounts. No customer/payment-provider entities are introduced.

RefundItem stores returned quantity, zero-default restock quantity, original saved
Decimal(12,2) unit price and exact Decimal(22,2) line total. Quantities are positive
PostgreSQL integers; restock quantity is within zero through returned quantity.
The line amount must equal saved unit price times returned quantity. One original
sale item appears at most once per refund; later refunds may reference the same
original item. Identity/ownership snapshots remain in the preserved SaleItem,
rather than duplicating current catalog names or prices.

## Isolation and history relationships

Composite restrictive foreign keys enforce parent refund/sale/organization/branch
consistency. A source-item key additionally binds original sale item ID, sale,
tenant, branch, placement, merchant and saved unit price. A foreign item, another
sale in the same branch, substitute placement/merchant or changed refund price
cannot satisfy this relationship. Merchant ownership remains historical.

Refund actors reference User, not a removable membership. Membership removal or
account soft deletion does not remove history; hard deletion of referenced actors
is restricted, matching existing sales. Related original history is restrictive.
Referenced source price or restock quantity updates are restricted rather than
cascading changes into recorded refund amounts/movement deltas. There are no
record edit/delete APIs; database administrators are not an application API.

Indexes support per-sale stable completion-time history, branch/time reports,
cumulative item-quantity reads and historical merchant refund queries. Additional
composite unique indexes exist to enforce original-source and movement relations.

## RETURN movement constraints

RETURN requires a positive delta and a refund-item link. Its tenant/branch/placement
and delta must match that item's original placement and exact restock quantity.
At most one RETURN movement can link to an item. Zero restocking cannot create
a RETURN movement. Other movement types cannot carry a refund link; existing
negative SALE linkage and RECEIPT/ADJUSTMENT checks remain unchanged. A movement
cannot carry both sale-item and refund-item links.

Both internal links are omitted from existing inventory response types/selections;
merchant history still omits actor IDs. The stock APIs do not expose a RETURN
creation operation. Adding records alone does not automatically change stock.

## Integrity boundary and verification

These are row-local persistence constraints and transaction primitives, not the
completed refund service. Cross-record total reconciliation, at-least-one-line
commands, cumulative over-return prevention, fresh role/access checks, bounded
stock increments and normalized idempotent replay are not implemented yet. They
belong to the next approved API part. No trigger, cache or new infrastructure is
introduced to pretend these service rules are already enforced.

Prisma formatting/validation/client generation, backend formatting/lint/build,
329 unit tests, 133 HTTP tests and 181 disposable PostgreSQL tests across five
suites pass. The new suite has 35 persistence tests covering exact capacity,
manual methods, field checks, tenant/branch/source-price relationships, uniqueness,
zero/partial/full restock representation, exact RETURN links/deltas, rollback,
history protection and private inventory projections. An upgrade test inserts
legacy sales and receipt/SALE history before the new migration and verifies
unchanged snapshots/balances and nullable new links afterward.

One unchanged POS HTTP test initially returned an unexpected 404; a subsequent
full HTTP run passed. No POS implementation was changed. Tests apply repository
migrations only in random refunds_test schemas in explicit disposable PostgreSQL,
then remove their schema. The test container is removed after verification. No
application database is migrated, reset or seeded. No frontend/rendered QA applies
to this persistence-only part; future refund screens need their own QA or waiver.
