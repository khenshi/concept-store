# Item Returns and Manual Refunds

**Status:** Persistence, create/replay API, staff/merchant history/detail with
remaining quantities and refund-aware Reports API implemented. Refund forms and
rendered report refund/net cards are not implemented yet.

## Implemented scope

Refund and RefundItem records preserve partial/full whole-item returns against an
immutable completed sale. The create API records manually issued refunds and
optionally restocks original placements through linked RETURN movements. Existing
checkout, sale/history responses and receipt/adjustment commands are unchanged.
Reports API now summarizes gross/refunded/net sales by separate sale and refund
completion dates, while existing report cards remain gross-only. Existing
inventory screens accept positive RETURN history and label it Return; no refund
dialog or new inventory stock command is added.

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

## Create API and authorization

```text
POST /organizations/:organizationId/branches/:branchId/sales/:saleId/refunds
```

Authentication and current organization membership are required. OWNER may issue
refunds in any tenant branch; MANAGER only in assigned branches. CASHIER and
MERCHANT are denied. The transaction reloads membership, non-deleted-user state,
role and branch grants, including before replay/recovery. Missing, foreign and
inaccessible branches/sales/items use 404. Every source and stock query includes
organization and branch scope; another sale's item cannot be substituted.

The command accepts UUID v4 requestId, 1–100 distinct original sale-item lines,
positive integer quantity, optional restockQuantity (default zero), trimmed
2–500 character reason, actual CASH/GCASH/CARD paymentMethod and
refundConfirmed: true. Noncash requires a trimmed 2–100 character paymentReference;
CASH rejects that field, including null. UUIDs normalize to lowercase. Nested
unknown fields, arbitrary prices/totals/placement/merchant IDs and all query
parameters are rejected. JSON strings are not coerced into quantities or booleans.

Confirmation attests that staff already issued money manually; no provider is
called and no reference is verified. The actual method may differ from the sale.
There are no tender/change fields, discretionary refund amounts, fees, return
window, exchange, edit/delete, printing or refund-only goodwill operation.

## Atomic amounts, cumulative limits and stock

The service uses the original saved unit price, not current catalog prices, for
exact line amounts and their total. A precision-40 Decimal clone preserves the
approved 100-line maximum capacity without JavaScript floating-point arithmetic.
Across all completed refunds, each original item's cumulative returned quantity
cannot exceed its sold quantity. Restock is within zero through returned quantity.

A SERIALIZABLE transaction locks the original tenant/branch sale before reading
cumulative quantities, then processes placements in the same stable order as
checkout. Refund, items, bounded stock increments and linked RETURN movements
commit or roll back together. A positive restock updates only the original sold
placement in the original branch and records its actual resulting balance. Zero
restock creates no movement or stock change. Stock overflow rejects the whole
command, even after another line was written; quantities remain within
0..2147483647. Inactive products and merchants can be restocked without reactivation.
Original sale/items, SALE movements and prices remain unchanged.

RETURN history uses the neutral reason Returned goods restocked, not the private
refund reason. Internal refund links remain omitted; merchant movement history
retains actor exclusion and own-placement scope. No merchant refund command
response is available through this staff-only endpoint.

## Replay, recovery and response

Tenant request-ID uniqueness compares branch, sale, original authenticated actor
and canonical sorted lines/quantities/restocking, trimmed reason, actual method,
reference and explicit confirmation. An identical authorized replay returns the
original completed result before remaining-quantity or lifecycle checks. It does
not increment stock or create records again. Content/actor/branch/sale reuse is
409 REQUEST_ID_CONFLICT, without returning the conflicting command or actor.

Serialization/deadlock or uniqueness failure fully rolls back. A fresh authorized,
read-only transaction may resolve an already committed identical command; otherwise
409 REFUND_RETRY requires an explicit unchanged-command/request-ID retry. There
is no hidden write retry. Over-return returns 409 RETURN_QUANTITY_EXCEEDED; stock
overflow returns 409 STOCK_OVERFLOW. Those conflicts require refresh/review.

201 returns an explicit STAFF response with refund identity/code/completion time,
original receipt code, reason, actual manual method/reference, exact two-decimal
total and original saved item identities/ownership/prices plus returned/restocked
quantities. It excludes requestId, refundCommand and actor attribution. The
Swagger contract describes the command, response and conflicts. Persisted actor
attribution is internal, not a response.

## History/detail reads and remaining quantities

```text
GET /organizations/:organizationId/branches/:branchId/sales/:saleId/refunds?page=&limit=
GET /organizations/:organizationId/branches/:branchId/sales/:saleId/refunds/:refundId
```

OWNER reads tenant branches; MANAGER requires a current assignment. MERCHANT may
read an original sale only when it contains items owned by the currently linked
profile. Historical own-sale access does not require a current branch assignment
or active product/merchant/placement. A branch assignment by itself never exposes
another merchant's sale/refund. Unlinked merchants and sales without own items
return 404; CASHIER is denied, without changing existing cashier own-sale APIs.
Current membership, non-deleted-user state, role, branch grants and profile link
are reloaded inside each read transaction. Wrong tenant/branch/sale/refund or
refunds without matching own items use the same not-found behavior as absent IDs.

List accepts integer page 1..21474836 (default 1) and limit 1..100 (default 50).
No date/merchant/payment filter is accepted. Unknown, malformed and repeated-array
queries are rejected; detail accepts no query fields. Path IDs require UUID v4
and normalize to lowercase. Records order by completedAt descending then ID
descending, with items by original sale-item ID ascending. Empty or past-end pages
return an empty items array without losing remaining quantities.

The list response includes scope, items, page, limit, total, totalPages and
remainingItems. Each remaining entry has original saleItemId, soldQuantity,
returnedQuantity, restockedQuantity and remainingQuantity. These integer quantities
cover every completed refund, independent of page bounds; original items without
returns have explicit zero totals. Staff see all original sale items and all
matching refunds. Merchant counts/pages and remaining entries cover only own
original items and refunds containing own items. Restocking is not subtracted a
second time from returnable quantities.

Staff list/detail rows use the immutable create-response STAFF contract, including
exact total, actual payment method/reference and reason, but no actor/request/
private command. Merchant rows use a separate MERCHANT contract: refund/sale IDs,
receipt/refund code, completion time, saved branch ID/name/code, only matching own
item snapshots with return/restock quantities and exact ownItemsSubtotal. They
never select or return whole refund/sale totals, payment fields, reason, actor,
other item counts/identities, inventory placement IDs, contacts or private command
metadata. Shared linked profiles have the same own history; relinking/unlinking
changes subsequent reads, without trusting stale request context.

All authorization, counts, full cumulative sums and page rows share one
REPEATABLE READ snapshot. A concurrent refund cannot produce mismatched counts,
remaining quantities and rows within a response. Reads never mutate sales,
refunds, stock or movements. Original saved prices/names/ownership/branch identity
survive current price, name and lifecycle edits. Swagger describes separate
scope-discriminated staff and merchant list/detail schemas. Refund forms and
rendered report refund/net cards remain later parts, not implied by these routes.

## Persistence verification

Database constraints are row-local; cross-record reconciliation, cumulative limits,
fresh access and atomic replay/stock rules are enforced by the service above.
No production trigger, cache or new infrastructure is introduced.

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
to that persistence-only part; future refund screens need their own QA or waiver.

## Create API verification

Backend format/lint/build, 354 unit tests (32 suites), 169 HTTP tests (six suites)
and 200 disposable PostgreSQL tests (six suites) pass. New command coverage has
25 service unit, 36 HTTP and 19 real PostgreSQL tests. It includes manual methods,
strict confirmation/field/query validation, exact original-price arithmetic,
100-line maximum capacity, partial/full/multiple returns, current role/grant/user
checks, canonical/conflicting replay, historical inactive items, zero restock,
later-line overflow rollback and injected parent/item/movement failures.
Concurrent over-return, identical/conflicting request IDs, checkout and
receipt/adjustment races reconcile stock with immutable ledger history.

Frontend formatting/lint/type checking, 569 tests across 75 files and production
build verify the small RETURN inventory-history compatibility update. No new refund
screen is included; rendered refund QA remains required in the later frontend/final parts.
All PostgreSQL migrations/tests use isolated disposable schemas, never application
database migration, reset or seed.

## History/detail verification

Prisma validation, backend formatting/lint/build, 364 unit tests across 33 suites,
186 HTTP tests across six suites and 214 disposable PostgreSQL tests across six
suites pass. New read coverage adds 10 unit, 17 HTTP and 14 PostgreSQL tests.
Tests cover empty/past-end pages, tied-time stable ordering beyond 50 refunds,
all-page cumulative quantities, explicit saved staff results, strict reduced
merchant keys/selections, mixed ownership, other-only refund denial, no-own-refund
history, inactive historical records, shared profiles, relinking/unlinking, current
manager grants/roles, removed/deleted users, foreign IDs and concurrent snapshot
consistency. Maximum-capacity own subtotals and 100 fully returned/restocked
original lines remain exact. Read-only checks compare original sales/refunds,
inventory and movements before/after reads. Existing command/race regressions
continue to pass. No schema/migration or frontend changes are included in this
read-only part, and the application database is untouched.
