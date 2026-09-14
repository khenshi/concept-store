# Sales Reports

**Status:** Backend API and owner/manager Reports screens implemented. Merchant
Reports navigation and own-only screens are not implemented yet.

## Responsibilities and exclusions

Read-only summaries of completed branch sales, using persisted Sale/SaleItem
amounts and quantities. Reports describe gross recorded sales, not profit, net
sales, cash available, commissions or merchant payouts. No refunds, shifts,
settlements, exports, rankings, trends, printing or payment verification are
provided. Reports never mutate sales, inventory, payments or ledger history.
No report entities, migration, analytics infrastructure or new indexes are added.

## API

```text
GET /organizations/:organizationId/reports/sales/branches
GET /organizations/:organizationId/branches/:branchId/reports/sales?from=&until=
```

Authentication and current organization membership are required. OWNER, MANAGER
and MERCHANT are allowed; CASHIER is denied, including assigned cashiers. Existing
cashier own-sales history in POS is unchanged. UUID v4 identifiers and DTO
whitelisting reject malformed identifiers and unknown query fields.

Summary requires both strict UTC `from` (inclusive) and `until` (exclusive)
timestamps ending in Z with at most millisecond precision. `from < until` and
the range cannot exceed 366 days. Applied ranges return normalized UTC timestamps.
Branch lookup accepts no query parameters. The backend does not infer a local
calendar day or timezone. The frontend converts inclusive Philippines calendar
dates into the required half-open UTC range.

## Authorization and branch lookup

Fresh membership, role and merchant link are loaded inside a REPEATABLE READ
transaction, filtering out soft-deleted users. Branch access and all aggregate
reads share that snapshot. Removed memberships, changed roles, revoked manager
grants and merchant relinking affect subsequent reads despite stale request context.
Missing/deleted membership and foreign organizations use 404; disallowed current
roles use 403. Missing/inaccessible/foreign branches use the same 404.

Lookup returns only `{ id, name, code }`, ordered by name then ID:

- Owners: all tenant branches.
- Managers: explicitly assigned branches only.
- Merchants: explicitly assigned branches union branches containing historical
  own items for the currently linked profile. This is independent of report dates.
  No current product placement is required for historical sales access; an unsold
  current placement alone does not grant Reports access.

Merchant assignments can grant an empty own-only report, never branch-wide data.
Unlinked merchants have no historical branch lookup/access, but may read zero
own-only totals in explicitly assigned branches. Shared profiles see the same own
data; relinking changes future report access without rewriting historical ownership.
Inactive products/merchants, renames and live price changes do not change recorded
totals. The separate lookup does not widen general branch/address/inventory routes.

## Responses and aggregation

Staff summary has `scope: STAFF`, `branch`, `from`, `until`, `grossSales`,
`transactionCount`, `unitsSold` and `payments`. A fixed CASH, GCASH, CARD array
contains `paymentMethod`, `grossSales` and `transactionCount`; missing methods
return zeros. GCash/card are manual, unverified payments. Cash amounts sum sale
totals, not tender/change. Each sale contributes once, regardless of item count.
Units sum quantities from its tenant/branch-scoped items. Payment totals/counts
reconcile to the staff summary within the same snapshot.

Merchant summary is a separate response with `scope: MERCHANT`, `branch`, `from`,
`until`, `ownGrossSales`, `ownTransactionCount` and `ownUnitsSold`. Only own
historical item amounts/quantities are aggregated; own transaction count counts
distinct sales containing those items. A mixed sale contributes only own items
and one matching transaction. Even an own-only sale never returns a staff report.
The merchant query does not select whole-sale total, payment fields, cashier IDs,
other merchants' item/count data, contacts or private request/command metadata.

Amounts are exact nonnegative two-decimal PHP strings without single-sale size
limits. Counts/units are nonnegative integer strings, avoiding JSON/JavaScript
numeric overflow. Empty authorized periods return `0.00` amounts and `0` counts/
units. PostgreSQL numeric SUM/COUNT queries aggregate the whole matching period,
not a paginated history page or frontend estimates. Parameterized Prisma SQL binds
tenant/branch/profile/time values; no client data is interpolated into SQL text.
Sales totals and quantities use separate aggregation to avoid item-join inflation.
Existing tenant/branch/completion-time and merchant-item indexes are retained.

Swagger/OpenAPI describes required ranges, errors and separate response schemas
with explicit STAFF/MERCHANT discriminator mappings.

## Owner/manager workspace

Reports appears in expanded/collapsed sidebar and mobile navigation for owners
and managers. Both organization and branch Reports routes mark Reports active
instead of Branches:

```text
/app/organizations/:organizationId/reports
/app/organizations/:organizationId/branches/:branchId/reports
```

The organization entry reads only the Reports identity lookup and requires an
explicit branch choice, even with one accessible branch. There is no All branches
total or silent fallback. The branch workspace rechecks the lookup before its
summary read and offers a labeled branch dropdown without a back button. Cashiers
cannot mount report reads. Merchant Reports navigation remains hidden until the
separate own-only screen is delivered; existing merchant Sales remains unchanged.

From/Through inputs are visibly labeled Philippines, inclusive (`Asia/Manila`).
Today is computed in that timezone independently of browser timezone. Fields
validate on each input after 300 ms, immediately on blur and on Apply; invalid
submission focuses the first invalid field. Same-day periods are valid, with a
maximum of 366 inclusive days. Typing does not fetch; Apply sets a new period.
Refresh/retry read the visibly labeled applied period, never write, and are blocked
while the draft dates are invalid. Branch changes reset the period to Philippines
today. There are no persistent report drafts.

Strict runtime schemas validate identity-only distinct options, STAFF scope,
branch/range correspondence, canonical exact money/integer strings, three distinct
payment methods and summary reconciliation before rendering. Merchant/private,
malformed or stale-scope responses are rejected. Aggregate values render without
floating-point conversion or single-sale size limits. Empty periods still show
zero summaries and all three payment rows, with explicit no-sales feedback.
Labels distinguish gross recorded sales from profit/payouts and manual unverified
GCash/card from payment-provider reconciliation.

Apply, branch changes and refresh clear old totals/options; failed or revoked reads
cannot retain stale summary/payment rows. Generation/unmount guards ignore late
responses after period, branch, organization, role or user changes. Access refresh
uses organization context; unavailable branches never cause automatic navigation.
Loading, no assigned branches, empty period, failure and denied access have distinct
feedback and safe read-only retry/access-refresh actions.

## Verification and delivery

Backend formatting/lint/build, 329 unit tests, 133 HTTP tests and 146 PostgreSQL
integration tests across four suites pass. Report coverage verifies roles and
fresh grants/links, strict query fields/ranges, empty periods, mixed ownership and
distinct transactions, payment reconciliation, more than one history page,
half-open/millisecond boundaries, high-capacity exact amounts, quantities beyond
32-bit range, private response keys, current access changes, other-branch/tenant
isolation, unchanged history after live edits and read-only behavior.

A controlled concurrent checkout verifies that staff summary and later payment
queries retain the same database snapshot; a subsequent report sees the new sale.
Tests use explicit disposable PostgreSQL URLs and random `reports_test_<uuid>`
schemas, applying existing migrations and dropping only their test schema. No
application database is migrated, reset or seeded. See
[backend test setup](../../backend/test/README.md).

Frontend checks pass: 532 tests across 75 files, lint, type checking, changed-source
formatting and production build. New tests cover explicit branch choice, sidebar/
mobile role visibility, Philippines midnight/date conversion, inclusive range
limits, debounce/blur/Apply/focus, read-only retries, missing/revoked access, branch/
date/user/role scope resets, late responses, exact large totals/counts and rejection
of malformed/private/wrong-scope data. Backend behavior is unchanged by this part.

Merchant frontend delivery remains the next approved part in docs/plans/current.md.
Rendered Reports responsive/dropdown/date/keyboard/focus/200% zoom QA is pending;
it needs browser access or a new explicit waiver. Previous milestones' waivers do
not apply, and automated checks do not certify rendered layout or accessibility.
