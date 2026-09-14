# Sales

Separate read-only [Sales Reports](reports.md) aggregate permitted completed
branch sales. They do not change these history/checkout routes or cashier access;
merchant reports remain own-item-only and never expose payment/whole-sale totals.

**Status:** Implemented, including staff POS history/receipts and separate read-only merchant own-sale screens. Rendered QA explicitly waived September 13, 2026, separately for the original milestone and navigation refinement.

The separate [manual refund API](refunds.md) references original sales and saved
items with tenant-safe keys. It records partial/full whole-item returns and optional
original-placement restocking without editing the sale. These original
sale/checkout/history contracts remain unchanged. Separate staff/own-merchant
refund history/detail APIs provide remaining original returnable quantities.
Owner/manager sale detail offers a return/refund dialog and saved refund history;
merchant detail shows only own returned lines/subtotals. Cashier detail does not
fetch refund APIs or mount refund-management controls. Original receipt printing
remains unchanged; refund records have no print operation. See the
[refund workflow](refunds.md) for confirmation, validation and retry safety.

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
or sale-edit workflow. The separate refund API preserves these original records.
The POS completion screen supports internal receipt printing.

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
No mutable sale/receipt routes are provided.

## Workspace screens

```text
/app/organizations/:organizationId/sales
/app/organizations/:organizationId/branches/:branchId/pos/sales
/app/organizations/:organizationId/branches/:branchId/pos/sales/:saleId
/app/organizations/:organizationId/branches/:branchId/sales
/app/organizations/:organizationId/branches/:branchId/sales/:saleId
```

Staff history and receipt detail now live inside the shared branch POS layout,
header/dropdown and Cart/Sales History navigation. Receipt detail keeps History
active and has a Return to sales history action. Internal page changes preserve the
same-branch cart/payment draft and date filters/pagination without sale/payment writes;
inactive history reads pause and re-entering it refreshes the authorized list.
Old staff `.../sales` and `.../sales/:saleId` deep links redirect to their POS
equivalents; merchants continue using these separate own-sale routes without POS
access. Pending/uncertain checkout prevents hiding recovery behind History.

Branch details expose sales history for owners/managers/cashiers and own sales for
merchants. POS completion links to its saved receipt within History. Staff
lists show receipt code/time, saved branch identity, exact total and saved cashier/
payment method. Cashier copy describes only their own sales; backend filtering
remains authoritative. Staff detail renders immutable receipt snapshots and offers
internal browser printing, never a checkout or sale mutation. Refresh/print retries
perform only reads/printing.

Merchants receive a Sales workspace/sidebar entry. Its identity-only historical
selling-branch lookup avoids general branch/address APIs and includes past selling
branches without current placement/assignment. Assigned branch details may instead
open an empty own-sales list. Empty lookup explains missing sales or merchant-profile
link and asks the owner to configure access. Merchant lists/details display only
own items, snapshot branch identity, receipt code/time and `Own items subtotal`.
They have no full receipt, print, POS or payment controls. The reduced runtime
schemas reject unexpected sale/item fields, including cashier/payment/whole-total
data, rather than falling back to staff contracts after a stale role change.

Lists default to 50 per page, with previous/next bounded pagination and optional
strict UTC From-inclusive/Until-exclusive filters. Applying/clearing filters resets
page to one. Counts are labeled permitted sales, never aggregate monetary reports;
merchant counts include only own matching sales. Responses validate IDs/scope,
pagination, exact line amounts/subtotals and distinct records before rendering.
Separate loading, empty/range-empty and failed/revoked access states offer read-only
retry and Refresh access. User/organization/role/branch/sale changes reset screen
state; obsolete reads cannot restore old staff receipts or merchant data. Refresh
clears stale data and print controls before making another authorized read.

The user explicitly waived rendered responsive, keyboard/dialog, zoom and print
QA for this POS/sales milestone on September 13, 2026. Automated tests do not
certify rendered layout, modal focus containment, contrast or actual printing.

## Verification and development examples

The frontend POS navigation/workspace refinement passes lint, type checking,
production build, changed-file formatting and 430 tests across 67 files. Tests
cover retained dates/pagination, embedded receipt links/active History navigation,
staff legacy redirects, unchanged merchant routes, cart/payment draft retention,
checkout switching locks and a single active print surface. Rendered QA for this
refinement was explicitly waived by the user on September 13, 2026, separately
from the original milestone. Rendered QA was not performed; automated checks do
not certify rendered behavior or actual printing.

Final milestone verification passes: Prisma format/validate/generate, backend
format/lint/build, 258 unit tests, 106 HTTP tests and 99 PostgreSQL integration
tests (twice consecutively), plus frontend format/typecheck/lint, 401 tests across
63 files and production build. All migrations and the demo seed were checked only
in a disposable PostgreSQL 17 container: three sales, exact totals and balanced
ledgers. The container and temporary data were removed; no application database
was migrated/reset. Rendered QA was waived rather than performed.

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
