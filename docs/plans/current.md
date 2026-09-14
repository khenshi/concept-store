# Current Implementation Plan

**Status:** Approved by the user; Part 1 reviewed and approved for commit. Part 2 follows; Part 3 is not implemented.

# Branch Sales Reporting MVP

## Confirmed direction

- Sales reporting only for now, not commissions, merchant payouts or profit.
- Reports are available to OWNER, MANAGER and MERCHANT, not CASHIER.
- Owners access all tenant branches; managers only assigned branches; merchants
  only sales involving products historically owned by their currently linked
  merchant profile. Cashiers retain existing own-sales history in POS.
- Continue delivery by parts: implement one approved part, stop for review, commit
  only after approval, then implement the next part.

## Approved first-version defaults

These approved defaults are implemented incrementally by the parts below:

- One explicitly selected branch at a time, even with one accessible branch.
  No combined All branches total in this version.
- Date inputs use Philippines calendar days (`Asia/Manila`), visibly labeled.
  Default range is today in that timezone, independently of browser timezone.
  From and Through dates are inclusive in the UI; convert to inclusive start and
  exclusive next-day end UTC timestamps for the API. Maximum range: 366 days.
- Summary only: gross recorded sales, matching transaction count and units sold.
  Staff additionally see CASH, manual GCASH and manual CARD totals/counts.
- No product rankings, daily trends, comparisons, exports or report printing yet.

## Smallest complete scope

### Read-only backend contract

Add a focused organization Reports service/controller within the current modular
monolith, reusing persisted Sale/SaleItem snapshots and existing membership,
assignment and historical merchant-sales authorization rules. No report tables,
background jobs, caches, new payment behavior or sales/stock writes.

Proposed routes:

```text
GET /organizations/:organizationId/reports/sales/branches
GET /organizations/:organizationId/branches/:branchId/reports/sales?from=&until=
```

Branch lookup returns identity-only `{ id, name, code }` options: tenant branches
for owners, assigned branches for managers, and explicit assignments union
historical own-selling branches for merchants. Historical options are not restricted
to the report date range, so an empty period does not remove accessible branches.
No addresses, branch-wide counts or unrelated merchant branches are exposed.
This lookup does not widen general branch/inventory permissions.

Both endpoints require authentication and fresh non-deleted-user membership.
Cashiers are denied even in assigned branches. Recheck role, branch grants and
merchant link inside a REPEATABLE READ transaction with report reads; stale request
context does not authorize old access. Tenant predicates apply to every sale/item
query and related branch. Inaccessible/foreign/absent branches use the same 404.
Unknown query fields, malformed UUID v4 IDs and malformed ranges are rejected.
Summary requires both strict UTC timestamps ending in Z (existing millisecond
precision rules), `from < until`, and a range no longer than 366 days. Branch
lookup accepts no query parameters. The API filters completion timestamps with
`completedAt >= from AND completedAt < until`, not server/browser local dates.

### Staff summary

OWNER/MANAGER response uses a staff discriminator and returns authorized branch
identity, applied UTC range, grossSales, transactionCount, unitsSold and a fixed
three-method payment breakdown with sales total and transaction count per method.
Gross sales sums persisted Sale.total once per completed sale, not joined item
rows. Transaction count counts distinct completed sales; units sum their item
quantities. Method totals/counts reconcile to the whole summary. Cash sales amount
is Sale.total, never cash tender; no tender/change/reference/actor details appear.
GCash/card remain explicitly manual and unverified, not provider reconciliation.

### Merchant summary

MERCHANT response uses a separate own-sales discriminator and returns authorized
branch identity, applied UTC range, ownGrossSales, ownTransactionCount and
ownUnitsSold. Sum only persisted own SaleItem.lineTotal and quantities, scoped by
current linked merchant ID and tenant/branch/date. Count distinct sales containing
at least one own item, not items and not every branch transaction. Mixed-merchant
sales contribute only own amounts/units and one matching transaction.

Never select or return Sale.total, payment method/breakdown/reference/tender/change,
cashier identity, other merchants' items/counts, contacts or private request/command
metadata in the merchant aggregation path. Do not offer a staff-shaped fallback,
even for a sale involving just one merchant. Relinking changes subsequent reports
without rewriting historical ownership; members sharing a profile see the same
own totals. Historical own sales remain reportable after product/merchant lifecycle
changes or removal of current placement/assignment, matching existing sales access.
An unlinked merchant has no historical lookup access; explicit assignments may
return branches with an empty own-only report, never whole-branch data. Show link
guidance in the workspace rather than inventing another profile selector.

### Aggregation and integrity

Aggregate in PostgreSQL rather than downloading sale histories or summing only one
paginated page. Use precise numeric aggregation and parameterized Prisma queries/
SQL when needed; no string-interpolated client values. Monetary values serialize
as exact nonnegative two-decimal PHP strings, without single-sale size limits or
floating-point rounding applied to aggregate totals. Aggregate counts/units are
nonnegative integer strings to avoid JSON/JavaScript integer overflow across many
valid sales. Empty authorized periods return zero totals/counts and all three
zero staff payment rows; no divide-by-zero averages are introduced.

Keep summary components within the same authorized database snapshot. Existing
tenant/branch/time and merchant-item indexes are the starting point. No migration
is planned; add only a demonstrated report-query index if measurements show it is
necessary, documenting the query/plan evidence. Do not add generic analytics or
authorization frameworks or refactor unrelated checkout/history behavior.

Report labels say gross recorded sales, not profit, net sales, available cash,
settlement or amounts payable. Existing system has no refund workflow; no invented
deductions, commissions, tax calculations or payment verification are performed.

### Organization workspace

Add Reports to organization sidebar/mobile navigation for owners/managers/merchants:

```text
/app/organizations/:organizationId/reports
/app/organizations/:organizationId/branches/:branchId/reports
```

Thin routes delegate to feature-owned Reports components. Organization entry
requires explicit authorized branch selection. Branch workspace has a labeled
branch dropdown, Philippines date inputs, Apply and read-only refresh/retry.
Do not change POS/history routes, cart behavior, merchant Sales navigation or
existing inventory workflows. Reports routes mark Reports active in the shell.

Use DESIGN.md and existing operational panels, shared controls and exact amount
formatting. Staff cards/payment rows and merchant own-only cards use separate
runtime response schemas; validate discriminator, branch/range scope, exact amounts,
counts and staff reconciliation before display. Reject malformed responses instead
of converting merchant data to staff contracts. Distinct loading, empty-period,
unassigned/unlinked, failed-read and denied-access states explain safe next actions.

Date fields validate each input after 300 ms, immediately on blur and on Apply.
Invalid/incomplete ranges block report reads. Applying a new range or changing
branch clears old totals; obsolete responses cannot overwrite the new scope.
Failed/revoked reads clear report data rather than showing stale totals or payment
rows. User/tenant/role/link/branch changes invalidate scoped state; read retry
never writes sales, payments or stock. Do not silently choose another branch or
period after access loss. No persistent/offline report drafts.

## Dependencies and explicit exclusions

Depend on Authentication, Organizations/Memberships/Branch Assignments, Branches,
Sales and historical merchant ownership, organization shell/context and DESIGN.md.
Preserve existing authorization distinctions and all unrelated inventory-api.ts,
root package files and performance-audit edits. Do not stage those user changes.

Exclude cashier Reports access, cross-branch totals, product rankings, trends,
exports/print/download, commissions, payouts, merchant settlements, costs/profit,
refunds/returns, shifts/cash reconciliation, fiscal invoices/taxes, payment
integrations, new roles/advanced permissions, analytics tables/infrastructure,
application database resets/seeding and unrelated refactors.

## Part-by-part delivery

Part 1 delivery: read-only Reports controller/service, identity-only scoped branch
lookup and separate STAFF/MERCHANT aggregates with fresh access checks inside a
repeatable-read snapshot. Strict required UTC ranges are bounded to 366 days;
unknown fields and cashier access are denied. Staff summaries count each sale
once and reconcile a fixed payment breakdown; merchants aggregate only own items
and distinct matching sales without selecting private/full-sale/payment fields.
Parameterized PostgreSQL numeric aggregates retain exact money and integer-string
counts/units across the entire period. No schema migration/new index or frontend
change is included. Backend format/lint/build, 329 unit tests, 133 HTTP tests and
146 disposable PostgreSQL tests across four suites pass. Tests include controlled
concurrent-checkout snapshot consistency, later edits, mixed ownership, more than
one history page, range boundaries, exact capacity, revoked access, private keys
and tenant/branch isolation. Reports/Sales/Branches/test docs are updated. The
application database and unrelated edits are untouched. Stop for review before
committing this part; rendered Reports QA remains for the later frontend parts.

1. Backend report DTOs/contracts/OpenAPI, scoped branch lookup and staff/merchant
   database aggregates; unit/HTTP/disposable PostgreSQL tests and Reports module
   documentation. Stop for review before committing.
2. Reports routes/sidebar, explicit branch selection/dropdown and staff summary/
   payment breakdown, date conversion/live validation and scoped read-state guards;
   frontend API/schema/component tests and documentation. Merchant navigation/UI
   is not exposed until its separate own-only screen is ready. Stop for review.
3. Merchant own-only summary and assigned/historical/unlinked states, final privacy/
   role/navigation/date/read regressions and documentation; final rendered QA or
   new explicit waiver. Stop for review, then commit and archive after approval.

## Verification and completion

Backend formatting/lint/build and unit/HTTP tests cover fresh roles/grants/links,
unauthenticated/cashier denial, tenant/branch guesses, strict fields/ranges, empty
results, multiple items per sale without double counting, all payment methods,
manual-payment labels, distinct own transaction counts and private response keys.
Real disposable PostgreSQL tests apply repository migrations only in random test
schemas; verify exact large monetary/quantity aggregates, half-open boundaries,
mixed ownership, inactive/renamed records, relinking/shared/unlinked profiles,
revoked access and consistent snapshots during concurrent completed checkouts.
Verify aggregates reconcile to the permitted persisted sales, not cart estimates.
Never migrate/reset/seed the application database for testing.

Frontend changed-file formatting/lint/typecheck/tests/build and diff checks cover
sidebar/role denial, explicit branch selection, Philippines midnight/date-range
conversion independent of browser timezone, debounce/blur/Apply validation, empty
states, read-only retry, branch/date/user/role changes, stale response rejection,
exact integer/amount rendering and merchant rejection of staff/private fields.

Rendered responsive sidebar/dropdown, date inputs, keyboard/focus and 200% zoom
checks require browser access or a new explicit waiver for Reports. Prior inventory
and POS waivers do not cover these new screens. Record actual checks versus waiver.
Update implemented behavior in docs/modules/reports.md and affected module docs
after each part; proposed work stays here. Archive this plan only after all parts
are reviewed/committed and QA is closed. The completed Inventory milestone remains
historical in its existing archive and does not authorize Reports implementation.
