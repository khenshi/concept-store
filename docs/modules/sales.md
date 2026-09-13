# Sales

**Status:** Persistence, checkout/scoped read APIs, POS payment confirmation and completion receipt printing implemented. Sales-history screens are not yet implemented.

## Implemented scope

`Sale` stores a completed transaction with organization/branch scope, creator,
organization-unique receipt code and request ID, completion time, payment method,
precise total, and payment fields. Organization, branch and cashier display names
are snapshots. A private JSON object stores the canonical checkout command for
idempotent checkout comparison; this data is never returned in checkout responses.

`SaleItem` snapshots product name/SKU/barcode, merchant name, quantity, unit price
and line total. It retains product ownership and the specific branch placement.
Composite foreign keys enforce organization, branch, placement, product and
merchant consistency. A sale cannot repeat a placement.

- Payment methods are CASH, GCASH and CARD. Cash requires tender covering total
  and exact change, with no reference. Manual noncash requires a trimmed 2–100
  character reference and no cash fields; references are not unique or verified.
- Quantities are positive PostgreSQL integers. Unit prices use Decimal(12,2),
  line totals Decimal(22,2), and sale/tender/change Decimal(24,2), supporting the
  approved quantity/price bounds and 100-line total capacity without floating point.
- Database checks reject nonpositive/nonfinite prices and totals, invalid payment
  combinations, empty receipt codes, nonobject commands and incorrect line totals.
- Restrictive foreign keys preserve referenced history when live records change.
  Display snapshots survive renames, lifecycle changes and membership removal.
- SALE inventory movements require a negative delta and a scoped sale-item link.
  Other movement types cannot carry that link; an item has at most one movement.
  Existing history responses explicitly exclude this private link. Merchant history
  continues to exclude actor IDs and shows only its existing own-stock scope.

The database checks are row-local. The checkout service additionally derives the
sum of all items and creates every matching deduction in one transaction. There
is no sale/item update or delete endpoint, payment entity, pending-sale state,
or refund workflow. The POS completion screen supports internal receipt printing.

## Checkout API and authorization

```text
POST /organizations/:organizationId/branches/:branchId/sales
```

Authentication and current organization membership are required. OWNER may
complete checkout in all tenant branches; MANAGER/CASHIER require assignments.
MERCHANT is denied. The service reloads membership/role and branch access inside
the transaction rather than trusting the role in an earlier request context;
soft-deleted accounts cannot complete or replay checkout. Missing, inaccessible
and foreign branches/placements return 404 before any checkout writes.

The strict command accepts requestId (UUID v4), 1–100 distinct placement lines
(UUID v4, positive integer quantity up to 2147483647, reviewed expectedUnitPrice),
paymentMethod and only its applicable payment field. Unknown top-level/nested
fields and duplicate placements are rejected. UUID command identifiers normalize
to lowercase. Prices/tender are trimmed decimal strings, not numeric JSON,
scientific notation or values with more than two fractional digits. Reviewed
prices are positive and bounded by existing branch prices; tender supports up to
22 integer digits. Cash requires tender covering total and rejects references
(including null); noncash requires a trimmed 2–100 character reference and rejects
tender (including null). Manual references remain unverified and reusable.

Only active products of active merchants can be sold. Actual prices and ownership
come from the authorized branch placements, not frontend totals or overrides.
Forty-digit decimal arithmetic derives each line total, the whole total and cash
change exactly across the approved maximum 100-line capacity.

Checkout uses SERIALIZABLE PostgreSQL isolation, with placement updates in stable
ID order. Sale/items, bounded stock decrements and one attributed SALE movement
per item succeed or roll back together. Read prices/lifecycle and competing stock
operations must have a consistent serialization order; stale concurrent writes
cannot overwrite balances. Each movement records the actual resulting stock and
a neutral reason, with a server-generated movement request ID. Other branches are
never changed.

## Conflicts, replay and response

- Changed prices return 409 `PRICE_CHANGED` with the authorized placement's current
  price; staff must review rather than silently retry with a new price.
- Inactive product/merchant returns 409 `PRODUCT_UNAVAILABLE`; insufficient stock
  returns 409 `INSUFFICIENT_STOCK`. Insufficient cash tender returns 400.
- Organization/request-ID uniqueness provides whole-checkout idempotency. Sorted
  lines, two-decimal prices/tender and trimmed reference form the private canonical
  command. Equivalent line order/decimal formatting replays the same original sale
  before checking current price, lifecycle or stock, including sold-out products.
- Replay requires current role/branch access and the original actor. Reusing the
  ID for another branch, actor or command returns 409 `REQUEST_ID_CONFLICT` without
  revealing the original command.
- Serialization/deadlock or uniqueness conflicts fully roll back. A fresh authorized
  transaction resolves a committed identical original when available; otherwise
  409 `CHECKOUT_RETRY` asks for an unchanged request-ID retry. No automatic new sale
  or hidden command retry is performed.

Completion/replay returns 201 with an explicit persisted snapshot: sale/branch/
organization IDs, receipt code/time, receipt identity names, payment fields,
two-decimal total/tender/change, and item snapshots/amounts. Private canonical
commands, checkout request IDs and creator IDs are excluded. No merchant contacts,
member directory or stock movement details are returned. These are internal
transaction records, not fiscal/tax invoices. POS completion renders and prints
these immutable snapshots; see [Branch POS](pos.md) for validation and safe retry UI.

## Sales reads and historical merchant branches

```text
GET /organizations/:organizationId/branches/:branchId/sales?from=&until=&page=&limit=
GET /organizations/:organizationId/branches/:branchId/sales/:saleId
GET /organizations/:organizationId/sales/branches
```

List/detail require authentication and current membership. OWNER reads all tenant
branches; MANAGER reads assigned branches; CASHIER reads only their own completed
sales in assigned branches. Foreign, inaccessible and missing branch/sale guesses
use 404. Fresh membership/role/profile and branch checks share a REPEATABLE READ
transaction with sale queries; list count and rows use the same snapshot and
authorization predicate. Removed assignments/memberships and role changes affect
subsequent reads, regardless of a stale context. Deleted accounts are denied.

MERCHANT reads only items historically owned by their currently linked profile,
including inactive products/merchants and zero-stock placements. Historical own
sales grant branch sales access without assignments or current-placement-based
authorization; explicit assignments may instead grant an empty own-sales directory.
An unlinked merchant has no historical access, receives empty assigned-branch lists,
and receives an empty historical branch lookup. Neither assignments nor a guessed
sale ID can expose another merchant's sale. Relinking changes subsequent reads
without rewriting historical ownership; multiple members linked to the same
business see the same own-sale projections.

Merchant list/detail uses a separate database selection containing sale ID,
receipt code/time, snapshot branch ID/name/code, and only own item ID/product ID,
product/SKU/barcode/merchant-name snapshots, quantity, unit price and line total.
`ownItemsSubtotal` is the exact two-decimal sum of those selected items, calculated
with 40-digit decimal arithmetic. The full-sale total, other items/item counts,
cashier/member identity, payment method/reference/tender/change, organization
receipt identity, request IDs and canonical command are never selected or returned.
This remains a reduced view even for a sale containing only one merchant;
there is no alternate full-receipt endpoint for merchants.

Lists return `{ items, page, limit, total, totalPages }`, newest completion first
then descending sale ID. `total` counts only permitted matching sales. Default
page/limit are 1/50; limit is 1–100 and page is bounded to 21474836 to keep database
offsets within integer bounds. `from` is inclusive and `until` exclusive; optional
strict UTC timestamps end in Z, with up to millisecond precision. Both supplied
requires from < until. Unknown fields, malformed dates/pagination and non-v4 UUIDs
are rejected. Details and branch lookup accept no query options.

The historical branch lookup is MERCHANT-only and returns current branch ID/name/
code, sorted by name then ID, with matching own historical items. No addresses,
counts or other-merchant branches are exposed; explicit assignments alone do not
add a branch to this historical list. This focused lookup does not widen existing
general branch-detail or inventory access. Staff details return the persisted full
snapshot shape from checkout completion for internal receipt rendering.
No mutable sale/receipt routes or sales-history screens are added.

## Verification and development examples

PostgreSQL tests use explicit disposable databases and random isolated schemas.
They cover payment and monetary bounds, scoped relationships, uniqueness,
restrictive deletion, snapshot preservation, failed-write rollback and private
inventory-history projections. Checkout coverage includes payment/command
validation, fresh roles/assignments, exact and conflicting replay, full-capacity
arithmetic, mixed ownership, injected sale/item/movement failures, concurrent
checkouts/withdrawals, duplicate requests and ledger reconciliation. Read coverage
includes role/tenant/branch/actor isolation, historical ownership, shared/relinked/
unlinked profiles, exact merchant projection keys/subtotals, stable filtered
pagination and UTC boundaries. Expanded PostgreSQL races cover receiving,
opposite multi-line carts, second-line movement rollback and lock-controlled
price/lifecycle changes. The destructive development seed adds three
completed examples with CASH/GCASH/CARD and a mixed-merchant sale, inserting items,
stock deductions and movements atomically. It is not the application checkout API.
