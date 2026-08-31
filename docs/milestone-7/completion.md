# Milestone 7 — Reporting and Dashboards Completion

## Status

Milestone 7 is complete for its approved initial scope.

The application now provides owner/manager operational reporting and a
merchant-specific read-only dashboard over the immutable and auditable records
created by Milestones 4–6.

## Delivered behavior

- Owner/manager store dashboard with sales, finalized store revenue,
  outstanding payouts, recorded payouts, inventory health, and recent activity.
- Filterable and paginated sales attribution report.
- Filterable and paginated current inventory report.
- Filterable and paginated merchant performance report.
- Explicit owner-managed merchant-user account links.
- Merchant dashboard restricted to the merchant linked to the authenticated
  organization membership.
- Existing settlement detail remains the authoritative payout and settlement
  history surface.

## Financial definitions

- Gross sales use immutable completed sale-item totals.
- Refund totals use completed refund items in the selected reporting period.
- Net sales equal gross sales minus refunds.
- Finalized store revenue uses commission, rent, and adjustments from approved
  or paid settlement snapshots only.
- Draft and reviewed settlements are excluded from finalized store revenue.
- Current inventory is a present-time snapshot and is not represented as a
  historical period balance.

## Explicit exclusions

- CSV or accounting exports
- Custom report builders
- Forecasting and AI analytics
- Materialized reporting tables
- Background analytics infrastructure
- Elaborate charting

## Delivery commits

- `5719c7b` — Milestone 7 architecture
- `38c3504` — owner overview metrics API
- `1a3a06d` — operational report APIs
- `2fd5f5c` — owner dashboard and reports UI
- `58b5895` — isolated merchant dashboard access
