# Milestone 7 — Reporting and Dashboards Design

## Scope

Milestone 7 adds read-only operational reporting over the completed sales,
inventory, refund, settlement, and payout records from Milestones 4–6.

The initial scope includes:

- an owner/manager overview dashboard;
- sales reporting by branch and merchant;
- current inventory and low-stock reporting;
- merchant performance reporting;
- settlement and payout visibility through the existing finance records; and
- a merchant dashboard restricted to the merchant linked to the signed-in user.

CSV exports, custom report builders, forecasting, accounting integrations,
materialized reporting tables, and elaborate charting are excluded.

## Reporting rules

- Dates are inclusive Philippine business dates and are converted to explicit
  UTC boundaries by the backend.
- Gross sales come from immutable completed `SaleItem` values.
- Refunds come only from completed `SaleRefundItem` records.
- Net sales equal gross sales minus completed refunds.
- Store-earned commission and fixed rent come from approved or paid settlement
  snapshots. Draft and reviewed settlements are operational liabilities, not
  recognized finalized revenue.
- Settlement adjustments remain separately visible and are not silently
  classified as commission or rent.
- Current inventory is a present-time quantity snapshot. Inventory movement
  history remains the audit source for how that quantity was reached.
- All money is calculated with Prisma/PostgreSQL decimal values and serialized
  as fixed two-decimal strings.

## Backend architecture

A focused `ReportsModule` owns reporting queries. It does not mutate source
records or copy financial data into new reporting tables.

Initial owner/manager routes:

```text
GET /organizations/:organizationId/reports/overview
GET /organizations/:organizationId/reports/sales
GET /organizations/:organizationId/reports/inventory
GET /organizations/:organizationId/reports/merchants
```

Common filters are `from`, `to`, `branchId`, and `merchantId` where relevant.
The backend validates that branch and merchant filters belong to the current
organization. Pagination is required for detailed rows.

The overview returns a compact composition of:

- gross sales, refunds, and net sales;
- finalized commission and fixed-rent revenue;
- outstanding approved settlement amount;
- recorded payouts;
- current stock and low-stock counts; and
- recent sales and settlements.

Controllers remain thin. `ReportsService` owns tenant-scoped aggregation and
response shaping. Existing sales and settlement services remain authoritative
for their transactional workflows.

## Merchant identity and isolation

Email addresses must not be used to infer merchant ownership. A nullable role
alone is also insufficient because a `MERCHANT` membership does not identify
which merchant record it may access.

Milestone 7 introduces an explicit tenant-scoped merchant account link:

```text
MerchantAccount
- organizationId
- merchantId
- userId
- createdAt
```

The link enforces one merchant account per user in an organization and uses
composite tenant foreign keys. Owner-only management validates that the target
user has the `MERCHANT` organization role. Removing or changing that role must
not leave usable merchant access.

Merchant report routes derive `merchantId` from this server-side link and never
accept it as an authority-bearing client value. Tests must cover unlinked
merchant users, cross-merchant access, and cross-tenant identifiers.

## Frontend architecture

- The organization overview becomes the owner/manager dashboard.
- A `Reports` destination provides filterable sales, inventory, and merchant
  performance tables.
- Existing settlement pages remain the settlement and payout history surface;
  reports link to them instead of duplicating finance actions.
- Merchant users see a dedicated read-only dashboard containing only their
  sales, current inventory, settlements, and payouts.
- Initial visuals use summary cards and accessible tables. Charts are added
  only when they clarify a trend that is difficult to read from totals.

## Security and integrity

- Every query includes `organizationId` derived from authenticated membership.
- Owner/manager routes reject cashier and merchant roles.
- Merchant routes derive the linked merchant server-side.
- Branch filters are validated inside the tenant before aggregation.
- Reports never recompute or mutate approved settlement snapshots.
- The frontend does not calculate authoritative financial totals.

## Delivery sequence

1. Reporting contracts, DTOs, owner/manager APIs, and isolation tests.
2. Owner overview and operational reporting UI.
3. Merchant account link, owner management, and authorization tests.
4. Merchant dashboard and milestone completion audit.
