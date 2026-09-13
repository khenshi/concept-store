# Sales

**Status:** Persistence implemented; checkout and sales APIs/screens are not yet implemented.

## Implemented scope

`Sale` stores a completed transaction with organization/branch scope, creator,
organization-unique receipt code and request ID, completion time, payment method,
precise total, and payment fields. Organization, branch and cashier display names
are snapshots. A private JSON object stores the canonical checkout command for
the approved subsequent idempotent checkout implementation.

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

These are row-local persistence constraints, not a checkout workflow. Checking
current membership/branch access, enforcing immutable API behavior, validating
the complete command, deriving the exact sum of all items, ensuring every item
has the matching deduction, and atomically completing checkout belong to later
approved plan parts. There are no application sale mutation/read endpoints yet.
There is no payment entity, pending-sale state, refund or receipt-printing workflow.

## Verification and development examples

PostgreSQL tests use explicit disposable databases and random isolated schemas.
They cover payment and monetary bounds, scoped relationships, uniqueness,
restrictive deletion, snapshot preservation, failed-write rollback and private
inventory-history projections. The destructive development seed adds three
completed examples with CASH/GCASH/CARD and a mixed-merchant sale, inserting items,
stock deductions and movements atomically. It is not the application checkout API.
