# Sales Reports

**Status:** Refund-aware backend API and owner/manager/merchant report cards
implemented. Final automated checks passed; refund-specific rendered QA explicitly
waived September 14, 2026. Final refund milestone reviewed and approved.

## Responsibilities and exclusions

Read-only summaries of completed branch sales and item refunds, using persisted
Sale/SaleItem and Refund/RefundItem amounts and quantities. Gross sales use sale
completion dates; refunds use refund completion dates independently of the
original sale date. Net recorded sales is gross minus refunds and may be negative;
it is not profit, available cash, commissions or merchant payouts. No shifts,
settlements, exports, printing or payment verification are provided. A separate
analytics API adds daily trends and top-product rankings; the existing frontend
still uses the unchanged summary endpoint. Reports never mutate sales, inventory,
payments or ledger history.
No report entities, migration, analytics infrastructure or new indexes are added.
The [manual refund API](refunds.md) records completed returns separately without
editing original sales. Frontend cards display separate gross/refunded/net figures;
staff gross sale payments and actual refund methods remain separate breakdowns.

## API

```text
GET /organizations/:organizationId/reports/sales/branches
GET /organizations/:organizationId/branches/:branchId/reports/sales?from=&until=
GET /organizations/:organizationId/branches/:branchId/reports/sales/analytics?from=&until=
```

Authentication and current organization membership are required. OWNER, MANAGER
and MERCHANT are allowed; CASHIER is denied, including assigned cashiers. Existing
cashier own-sales history in POS is unchanged. UUID v4 identifiers and DTO
whitelisting reject malformed identifiers and unknown query fields.

Summary requires both strict UTC `from` (inclusive) and `until` (exclusive)
timestamps ending in Z with at most millisecond precision. `from < until` and
the range cannot exceed 366 days. Applied ranges return normalized UTC timestamps.
Branch lookup accepts no query parameters. The backend does not infer a local
calendar day for summary reads. Analytics labels dates in Asia/Manila after exact
UTC filtering. The frontend converts inclusive Philippines calendar
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
`transactionCount`, `unitsSold`, `payments`, `refundedAmount`, `refundCount`,
`returnedUnits`, `netRecordedSales` and `refundMethods`. A fixed CASH, GCASH, CARD array
contains `paymentMethod`, `grossSales` and `transactionCount`; missing methods
return zeros. GCash/card are manual, unverified payments. Cash amounts sum sale
totals, not tender/change. Each sale contributes once, regardless of item count.
Units sum quantities from its tenant/branch-scoped items. Payment totals/counts
reconcile to the staff summary within the same snapshot.

Refunded amount sums each matching completed Refund total once. Refund count
counts matching completed refunds; returned units sum all matching RefundItem
quantities, regardless of restocking. A separate fixed CASH, GCASH, CARD
refundMethods array contains paymentMethod, refundedAmount and refundCount,
including explicit missing-method zeros. Those amounts/counts reconcile to the
refund summary. Actual refund method may differ from original sale method; methods
are never netted together or described as available cash/provider reconciliation.
Original transactionCount/unitsSold and gross payment breakdown are unchanged,
not net counts/units.

Merchant summary is a separate response with `scope: MERCHANT`, `branch`, `from`,
`until`, `ownGrossSales`, `ownTransactionCount`, `ownUnitsSold`,
`ownRefundedAmount`, `ownRefundCount`, `ownReturnedUnits` and
`ownNetRecordedSales`. Only own
historical item amounts/quantities are aggregated; own transaction count counts
distinct sales containing those items. A mixed sale contributes only own items
and one matching transaction. Even an own-only sale never returns a staff report.
The merchant query does not select whole-sale total, payment fields, cashier IDs,
other merchants' item/count data, contacts or private request/command metadata.
Own refunds sum only historically owned RefundItem amounts/quantities for the
current profile and count distinct refunds containing own items. Multiple own
lines contribute one matching refund, and other-only refunds contribute nothing.
There is no merchant payment/refund-method breakdown or whole-refund total,
reason, actor or private refund command selection. Own net is own gross minus own
refunds. Assigned unlinked merchants retain explicit own-only zeros.

Gross/refunded amounts are exact nonnegative two-decimal PHP strings without
single-sale size limits. Net uses canonical signed two-decimal strings, without
negative zero. Counts/units are nonnegative integer strings, avoiding JSON/JavaScript
numeric overflow. Empty authorized periods return `0.00` amounts and `0` counts/
units. PostgreSQL numeric SUM/COUNT queries aggregate the whole matching period,
not a paginated history page or frontend estimates. Parameterized Prisma SQL binds
tenant/branch/profile/time values; no client data is interpolated into SQL text.
Sale/refund streams and parent totals/item quantities use separate PostgreSQL
aggregation to avoid item-join or sale/refund-join inflation. Refund queries filter
Refund completion dates, never require the original Sale to be in the period.
Exact signed net subtraction uses BigInt cents without a Decimal precision cap.
Authorization, summaries and both method arrays share one REPEATABLE READ
snapshot. Existing scoped history/report indexes are retained; no additional
schema/migration/index is introduced by this part.

Swagger/OpenAPI describes required ranges, errors and separate response schemas
with explicit STAFF/MERCHANT discriminator mappings.

## Analytics API (backend delivery Part 1)

The analytics route accepts the same strict range, UUID and unknown-field rules.
It returns the existing role-appropriate summary plus `dailyTrends`, `topProducts`
and canonical integer-string `totalProducts`. Existing summary/lookup responses
remain unchanged. Fresh membership/user/role/link/grants, branch identity, summary,
methods, daily aggregates, product count, ranking and saved labels share one
REPEATABLE READ transaction. No client profile, role, ranking or limit overrides.

Daily rows cover every intersecting Asia/Manila date, ascending and zero-filled.
The UTC interval is filtered before bucketing; exclusive midnight contributes no
extra date. Maximum 366-day duration may intersect 367 dates for partial-day API
ranges. Sales use original completion dates and refunds independently use refund
completion dates, including older original sales. Staff rows contain `date`,
`grossSales`, `transactionCount`, `unitsSold`, `refundedAmount`, `refundCount`,
`returnedUnits`, `netRecordedSales`. Merchant rows use only the corresponding
own-prefixed fields plus `date`. Distinct parent counts prevent mixed/multiple
lines inflating counts. Daily totals reconcile to the same snapshot summary.

Products group by historical `productId`, include either sales or refunds in the
period, and rank by exact gross descending, units descending, product ID ascending.
At most ten rows are returned; `totalProducts` counts all contributing products.
A truncated ranking subtotal is not the whole report total. Refund-only products
have zero gross/units and possibly negative net. Sale/refund streams aggregate
separately in PostgreSQL to prevent join multiplication; only bounded results are
loaded, not paginated histories or live catalog records.

Each product row has `productId`, `productName`, nullable `sku`/`barcode`, saved
`merchantName` and gross/units/refunded/returned/net fields (own-prefixed for
merchants). Identity comes from the latest contributing original SaleItem snapshot
by original Sale.completedAt descending, then SaleItem.id descending; originals
outside the range may contribute through matching refunds. Live renames, prices
and inactive states do not rewrite those labels. Merchant aggregation and label
selection are restricted to the current linked profile, never other mixed-sale
items, private actors/commands, contacts or payment methods. Assigned unlinked
merchants receive zero-filled own days and empty products. Historical Reports
access does not widen POS or Inventory.

Money/counts/units retain exact unlimited canonical strings; BigInt cents compute
signed net without negative zero. No schema, migration, index or infrastructure
changes, and no frontend redesign is delivered in this part. New rendered QA is
required separately for future dashboard delivery.

Part 1 verification passes Prisma validation, backend formatting/lint/build,
372 unit tests across 34 suites, 199 HTTP tests across six suites and 238
PostgreSQL tests across six suites. Added analytics tests cover Manila zero-fill/
partial-day boundaries, mixed distinct counts, independent older-sale refunds,
deterministic ten-of-N ranking and saved identity ties, exact large money/units,
fresh access/relinking, reduced private-key projections and unchanged persisted
sales/refunds/stock/ledger. Paused concurrent checkout and staff/merchant refund
reads verify summary, daily rows and product rankings share one snapshot. The
test fixture was corrected to use returned inventory IDs rather than assume
checkout item order. Implementation is uncommitted pending Part 1 review.

## Owner/manager workspace

Runtime schemas require the complete expanded refund group and validate exact
signed net/method/count/unit reconciliation. Missing or incomplete groups and
legacy gross-only responses are rejected, never silently zero-filled. Merchant
contracts independently require the own refund group, without staff fallback or
private fields. Aggregate values render as exact strings without number rounding.

Existing gross cards retain original sale counts/units. Separate cards show refunded
amount, completed refund count, returned units and net recorded sales. Staff gets
three actual refund-method amount/count rows independently of gross sale payments;
there is no payment-method netting or available-cash claim. Date guidance explains
sale completion versus refund processing dates, including older original sales and
negative net periods. A refund-only period displays its refund/net values without
incorrect no-activity feedback. Empty periods display explicit zeros for both streams.

Reports appears in expanded/collapsed sidebar and mobile navigation for owners
and managers. Both organization and branch Reports routes mark Reports active
instead of Branches:

```text
/app/organizations/:organizationId/reports
/app/organizations/:organizationId/branches/:branchId/reports
```

The organization entry reads only the Reports identity lookup and reuses the shared
POS/Inventory/Reports branch if that lookup grants access. With no remembered choice,
it requires explicit branch selection, even with one accessible branch. An
inaccessible choice shows access feedback and the picker without selecting an
alternative or discarding another feature's valid preference. There is no All branches
total or silent fallback. The branch workspace rechecks the lookup before its
summary read and offers a labeled branch dropdown without a back button. Cashiers
cannot mount report reads. Merchants use the separate own-only view below;
existing merchant Sales remains unchanged.

Authorized explicit Reports URLs override the remembered choice after their scoped
report read succeeds. Reports dropdown changes update the common workspace branch
only after pending/unknown checkout/refund and programmatic navigation guards permit
the transition. Organization/user/role changes clear selection; same-role access
refresh revalidates it. Reports historical merchant choices never grant Inventory
or POS access. Only branch identity is remembered in memory; applied date reset
rules and report contracts are unchanged. Frontend checks pass with 702 tests
across 83 files; new rendered navigation/dropdown/focus QA remains pending final
delivery, independently of earlier Reports/refund QA waivers.

Final shared-branch frontend checks were rerun successfully: changed-file
formatting, lint/type checking, 702 tests across 83 files and production build.
Report date/scope/privacy regressions remain passing; backend/database contracts
are unchanged. The user explicitly waived rendered page-switching/dropdown/
keyboard/focus QA for shared branch selection on September 14, 2026, independently
of earlier Reports/refund waivers. Those checks were not performed; automated
tests do not certify rendered behavior. Both parts were reviewed and approved;
the [completed shared branch-selection plan](../plans/archive/shared-branch-selection-2026-09-14.md)
is archived.

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
zero gross/refund/net summaries and all three sale/refund-method rows, with explicit
no-activity feedback when both streams are empty.
Labels distinguish gross recorded sales from profit/payouts and manual unverified
GCash/card from payment-provider reconciliation.

Apply, branch changes and refresh clear old totals/options; failed or revoked reads
cannot retain stale summary/payment rows. Generation/unmount guards ignore late
responses after period, branch, organization, role or user changes. Access refresh
uses organization context; unavailable branches never cause automatic navigation.
Loading, no assigned branches, empty period, failure and denied access have distinct
feedback and safe read-only retry/access-refresh actions.

## Merchant workspace

Merchants now have Reports in sidebar/mobile navigation, alongside unchanged
read-only Sales. The same thin routes reuse the validated remembered branch or
require explicit selection when no usable choice exists, and use
the Reports identity lookup, not general branch/address/inventory or profile
directory reads. Assigned and historical own-selling branches remain selectable
regardless of the applied period; an empty period does not remove historical
access. There is no profile selector or combined branch total.

Separate strict MERCHANT runtime validation and own-only cards display Own gross
recorded sales, Transactions containing own items and Own units sold. Matching
transactions are distinct sales containing own items; mixed sales contribute
only own item amounts/units. Additional own-only cards display Own refunded amount,
Own net recorded sales and matching refund/returned-unit counts. Refund dates are
independent of the original sale date and own net may be negative, not profit or
payouts. No staff fallback, payment/refund-method breakdown, whole-sale
amounts/counts, cashier, contact, private metadata, print or mutation controls are
rendered or fetched. Extra/private/staff-shaped responses fail the read rather
than being silently stripped or converted. Own aggregates retain exact unlimited
money and integer strings and must have consistent empty/count/unit invariants.

Merchants share the Philippines date validation and scoped read guards. Applying
dates, switching branches, refreshing and failing/revoking access clear old own
totals; late staff/own responses cannot restore data after role, user, period or
access refresh changes. Refresh access is always available and clears organization
context/read state before reloading current grants and profile-linked totals.
Backend report reads independently enforce the current link inside their snapshot;
there is no client profile ID used to authorize or calculate totals.

Guidance explains current linked historical ownership, assignment versus own-only
access and owner-managed profile links. No accessible branches has separate
assignment/historical-access feedback. An empty own period shows zero own cards
and explains that missing profile links can also cause zeros in assigned branches.
The identity-only API does not disclose link status, so the frontend does not
claim an empty period proves a missing link. This avoids extra contact-bearing
profile reads or widening the approved Reports response. Access/links may be
checked with an owner, then refreshed; no alternate branch is silently selected.

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

Frontend checks pass: 567 tests across 75 files, lint, type checking, changed-source
formatting and production build. New tests cover explicit branch choice, sidebar/
mobile role visibility, Philippines midnight/date conversion, inclusive range
limits, debounce/blur/Apply/focus, read-only retries, missing/revoked access, branch/
date/user/role scope resets, late responses, exact large totals/counts and rejection
of malformed/private/wrong-scope data. Merchant regressions additionally cover
own-only values, explicit assigned/historical choices, missing/empty guidance,
date-independent historical options, revoked access/read-only retries, access
refresh after link changes, late staff/own responses and strict private-field
rejection. Final backend format/lint/build and all unit/HTTP/PostgreSQL suites
were rerun successfully; backend behavior is unchanged by the frontend parts.

The user explicitly waived rendered Reports responsive/dropdown/date-input/
keyboard/focus/200% zoom QA on September 14, 2026. Those browser checks were not
performed; automated checks do not certify rendered layout or accessibility.
This is a new Reports-specific waiver, not inherited from prior milestones.
All three delivery parts have been reviewed and approved. The completed plan is
archived after the final implementation commit.

## Refund-aware aggregation verification

Prisma validation, backend format/lint/build, 369 unit tests across 33 suites,
189 HTTP tests across six suites and 231 disposable PostgreSQL tests across six
suites pass. Added coverage includes five unit, three HTTP and 17 PostgreSQL
tests, plus expanded existing capacity/zero/private-key assertions. Tests verify
actual refund methods, mixed own lines/distinct refunds, refund-only negative
periods, original-sale-outside-period recognition, half-open/millisecond boundaries,
more than 50 refunds, inactive history/current links, assigned own-only zeros,
branch/tenant scope and unchanged persisted data. Concurrent refunds prove staff
summary/method rows and merchant own sale/refund streams share one snapshot;
subsequent reads see the committed refund. An initial unrelated-branch fixture
lacked a merchant assignment; it was corrected and the full PostgreSQL rerun passed.

Frontend changed-file formatting, lint, type checking, production build and 590
tests across 75 files pass. The 21 new schema tests cover complete expanded and
legacy compatibility, negative/refund-only periods, canonical zero, incomplete
groups, signed-net validation, exact unlimited arithmetic, method/count/unit
reconciliation and merchant private-field denial. No new rendered screens/cards
are included; future refund UI needs its own rendered QA or waiver. Tests apply
migrations only in disposable random schemas. No application database is migrated,
reset or seeded.

## Refund-aware frontend verification

The refund UI part passes frontend changed-file formatting, lint, type checking,
production build and 680 tests across 82 files. Expanded report tests verify
required complete groups (no legacy fake-zero fallback), refund-only negative
periods, independent gross-payment/refund-method panels, processing-date guidance
and merchant own-only cards without payment/private exposure. Existing exact-
capacity, signed arithmetic and date/scope/read-only regressions remain passing.
No backend/schema/database/infrastructure changes are included in this UI part.
New refund-aware rendered QA remains pending final verification; the historical
Reports waiver above applies only to the prior gross-only milestone.

Final refund milestone regressions pass Prisma validation/generation, backend
format/lint/build, 369 unit, 189 HTTP and 231 disposable PostgreSQL tests, plus
frontend changed-file formatting, lint/typecheck/build and 680 tests. Report
independent-date/negative-net, exact method/own totals, read-only privacy and
concurrent-snapshot checks all pass. The temporary database container/data were
removed, without application database operations. The user explicitly waived new
refund-aware responsive, dialog/keyboard/focus, dropdown and 200% zoom QA on
September 14, 2026, separately from the historical gross-only Reports waiver.
Those checks were not performed; automated checks do not certify rendered layout
or accessibility. Final delivery was reviewed and approved; the completed refund
plan is archived in
[Item Returns and Manual Refunds MVP](../plans/archive/item-returns-and-manual-refunds-mvp-2026-09-14.md).
