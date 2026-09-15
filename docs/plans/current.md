# Current Implementation Plan

**Status:** Approved September 15, 2026; Part 1 implemented, uncommitted and
awaiting review. Parts 2–4 have not started. The user confirmed
including sales trends and top-selling products, grouped by product ID and ranked
by gross sales.

Shared branch selection across POS, Inventory and Reports is complete. Both parts
were reviewed and approved; final automated checks passed and rendered branch-
navigation QA was explicitly waived September 14, 2026. The historical plan is
archived in
[Shared branch selection](archive/shared-branch-selection-2026-09-14.md).

## Reports dashboard redesign and sales analytics

### Direction and smallest complete scope

Redesign the existing branch Reports page using the supplied dashboard reference
for hierarchy, not its colors or unsupported figures. Keep DESIGN.md warm stone
canvas, paper surfaces, graphite actions, fine borders, editorial typography and
operational density. Add daily sales trends and a bounded top-products table using
recorded sales/refunds, not live inventory estimates. This explicitly includes new
reporting capabilities; no broader hardening milestone is authorized here.

Retain existing Reports routes/sidebar, shared branch preference, Philippines date
validation and explicit Apply/refresh semantics. One branch and one applied period
drive every dashboard section. No all-branches or tenant-combined figures.

### Dashboard composition

- Compact header with branch dropdown and visibly labeled Philippines From/Through
  dates and Apply/Refresh controls. Preserve 300 ms input validation, immediate
  blur/submit validation, first-invalid focus and branch-date reset rules.
- Four primary cards: gross recorded sales, refunded amount, net recorded sales
  and completed transactions. Merchant labels clearly say own items/own figures.
  Secondary metrics retain units sold, completed refund count and returned units;
  original counts/units remain gross, not silently netted.
- Two trend panels inspired by the reference: daily gross versus refunds, and
  daily net recorded sales. Include legends, explicit date/timezone basis, zero
  lines and negative net values. No fictional percentage changes or comparison
  periods. Exact values remain available through keyboard-accessible day details
  and an accessible daily-data table/disclosure; meaning never relies on color.
- A Top 10 products by gross sales table: rank, saved product identity/SKU and
  merchant name, units sold, gross sales, returned units, refunded amount and net
  recorded sales. No misleading single current price, inventory status or photos.
  Phone layouts use contained horizontal scrolling with real headers and clear
  labels; long identities and exact large figures must remain readable.
- Staff keep separate gross sale-payment and actual refund-method breakdowns,
  arranged side-by-side where space permits. Merchant dashboard has neither;
  it must not request staff data then hide it. Explain net is not profit, payout
  or available cash, and refunds use their own completion dates.

### Read API and compatibility

Add one focused read route in the existing organization Reports module:

```text
GET /organizations/:organizationId/branches/:branchId/reports/sales/analytics?from=&until=
```

Keep existing branch lookup and gross/refund summary GET contracts unchanged.
The new analytics endpoint includes the existing role-appropriate summary plus
daily trends and top-products data in one response, avoiding separately fetched
inconsistent panels. Separate strict STAFF/MERCHANT OpenAPI/runtime contracts.
Do not accept role/profile/tenant overrides or arbitrary grouping/ranking/limits.
Use existing strict UTC from-inclusive/until-exclusive DTO validation and maximum
366-day duration; reject unknown queries and malformed UUIDs.

Fresh membership, non-deleted user, role, manager assignments, merchant link,
branch identity and every summary/trend/ranking query share one REPEATABLE READ
transaction. Reuse focused existing summary/auth logic inside this transaction;
do not compose independent summary/analytics transactions. Preserve owner-all-
tenant, manager-assigned and historical/assigned merchant own-only Reports rules.
Cashiers remain denied. Missing/foreign/inaccessible objects retain the same
not-found behavior. Merchant historical access does not widen Inventory or POS.

### Daily trends

- Bucket UTC completion instants into Asia/Manila calendar dates, oldest first.
  Sales use Sale.completedAt; refunds use Refund.completedAt independently, even
  when the original sale is outside the period. Partial-day API ranges filter
  exact instants first; labels are the Philippines dates intersecting the range.
- Return every intersecting date with explicit zeros for no activity. Inclusive
  frontend calendar ranges contain at most 366 rows; arbitrary supported UTC
  ranges can intersect at most 367 Philippines dates. Keep bounds explicit.
- Staff daily rows contain date, grossSales, transactionCount, unitsSold,
  refundedAmount, refundCount, returnedUnits and netRecordedSales. Merchant rows
  use separate own-prefixed quantities/amounts/counts, with no staff methods,
  other merchants' records, private actors, contacts or command metadata.
- Count distinct matching sales/refunds per day; multiple lines cannot inflate
  transaction/refund counts. Sum daily amounts/counts/units back to the overall
  summary. Each daily net equals gross minus refunds and may be negative.

### Top products and saved identity

- Group by stable product ID within the authorized branch/profile scope, never
  product name. Aggregate all matching original sale-item amounts/units and all
  matching refund-item amounts/units independently by their completion dates.
- Include products with either sales or refunds in the period. Refund-only rows
  have zero period gross/units and negative net; never exclude a refund because
  its original sale is older. Rank by exact gross sales descending, then units
  sold descending, then product ID ascending for deterministic ties.
- Return at most ten rows and the total distinct matching product count so the
  UI can state Top 10 of N. This is a bounded ranking, not a complete-product
  directory; its subtotal must not be presented as the whole report total.
- Each row contains productId, saved productName, nullable SKU/barcode, saved
  merchantName and exact role-appropriate sales/refund/unit/net fields. Choose
  identity deterministically from the latest original SaleItem snapshot among
  contributing sales/refunds, ordered by original sale completion time then
  SaleItem ID descending. Live renames, prices and lifecycle changes must not
  rewrite historical labels or totals. No contact-bearing catalog/profile reads.
- Merchant grouping and identity selection filter only the current linked
  profile's historical items, including mixed transactions. Assigned unlinked
  merchants get explicit own zeros, zero-filled days and no product rows.

### Exactness, performance and frontend safety

Aggregate the entire matching period in PostgreSQL with parameterized scoped SQL,
not by downloading paginated sale histories. Sum sale/refund streams separately
to avoid join multiplication. Retain existing indexed date/branch/profile access
patterns; no schema/index/cache/queue/infrastructure additions in this version.

Money and quantities/counts remain canonical exact strings beyond JavaScript or
single-sale limits. Signed net forbids negative zero. Frontend strict schemas
validate required analytics groups, scope/branch/applied-range correspondence,
contiguous dates, zero/count/unit invariants, daily/summary reconciliation,
unique products, bounded row counts and deterministic ranking. Merchant contracts
reject all unexpected staff/private fields rather than stripping/falling back.
Chart geometry may use bounded normalized numeric coordinates derived from exact
integer ratios; labels, tooltips, table values and arithmetic stay exact strings/
BigInt. Do not directly convert unlimited amounts to Number or imply chart pixels
are accounting precision. Prefer repo-native SVG/HTML and existing components,
not an unnecessary chart framework or bitmap mockup.

All panels clear together on Apply/branch/refresh/access changes and load from one
analytics response. Failed or denied reads cannot retain stale cards/chart/table
data; obsolete responses cannot restore it after user/role/branch/organization/
period changes. Retry remains read-only; no successful write is replayed. Preserve
checkout/refund/navigation locks and existing organization-scope safeguards.
Provide explicit loading, empty, refund-only, denied and failed states.

### Exclusions

No visitors/customer analytics, profit/expenses, forecasts, unsupported percentage
badges, current inventory/low-stock statuses, product images, exports/printing,
commissions/payouts, payment providers, multi-branch comparisons, live sockets,
new roles/permissions, analytics persistence/infrastructure or unrelated refactors.
No general existing-modules hardening audit/fixes in this milestone. Preserve
unrelated Inventory API, root package and performance-audit edits. Never migrate,
reset or seed the application database for testing.

### Delivery by reviewed parts

1. Implement the scoped analytics GET, exact summary/daily/product aggregation,
   staff/merchant DTOs/OpenAPI and fresh snapshot authorization. Add unit/HTTP/
   disposable PostgreSQL privacy, date, ranking, exactness and snapshot tests.
   Update Reports/test docs; no dashboard UI yet. Stop uncommitted for review.
2. Implement strict analytics frontend contracts and owner/manager dashboard:
   reference-inspired cards/header, trend charts/accessibility, top-products table
   and separate payment/refund breakdowns. Preserve existing merchant view until
   Part 3; add staff schema/API/component/branch/date/late-read tests and docs.
   Stop uncommitted for review.
3. Implement the separately validated merchant own-only dashboard using the
   reduced analytics contract; no methods/private/staff fallback. Add privacy,
   historical/assigned/unlinked access and scoped reset/late-read regressions.
   Update docs and stop uncommitted for review.
4. Run applicable backend/frontend/Prisma checks and disposable PostgreSQL final
   regressions. Verify rendered responsive layouts at 320/768/1024/1440 pixels,
   charts/table/date/dropdown keyboard/focus, 200% zoom and non-color identification,
   or obtain a new explicit Reports-redesign QA waiver. Prior waivers do not cover
   these screens. Record results and stop for final review. Commit only after
   approval and archive only after all required work/QA are closed.

Each approved part is committed before beginning the next. No automatic commits
for an unreviewed part. Module docs describe implementation only after delivery.

### Part 1 delivery

Implemented the separate analytics read with unchanged summary/lookup contracts,
exact scoped PostgreSQL daily/product aggregates, one repeatable-read snapshot,
zero-filled Manila dates, saved identities and reduced merchant DTOs/OpenAPI.
No frontend, schema, migration, index or infrastructure changes. Backend checks:
Prisma validation, formatting, lint, build, 372 unit tests across 34 suites,
199 HTTP tests across six suites and 238 disposable PostgreSQL tests across six
suites pass. Coverage includes mixed lines, refund-only/partial-day boundaries,
deterministic top-ten/identity ties, exact large totals, grants/relinking/privacy,
read-only preservation and concurrent checkout/refund snapshots. A test fixture
initially assumed checkout item order; it now uses the returned inventory ID and
the complete database suite passes. One unchanged refund HTTP validation test
intermittently returned 401; the immediate full rerun passed all 199 tests, with
no refund changes. The disposable container/data were removed. Rendered QA
belongs to future UI parts.
Unrelated user changes are preserved. Stop for review before committing Part 1.
