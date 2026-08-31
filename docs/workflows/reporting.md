# Reporting and Dashboards

**Status:** Current reference

## Owner and manager reporting

The organization overview presents:

- gross sales, refunds, and net sales;
- finalized store commission and rent revenue;
- approved settlement obligations;
- recorded paid settlements;
- current stock and low-stock counts; and
- recent sales and settlements.

The Reports workspace provides paginated sales attribution, current inventory,
and merchant performance tables. Reports support period, branch, and merchant
filters where meaningful.

## Reporting definitions

- Dates are Philippine business dates converted to explicit backend boundaries.
- Gross sales come from immutable completed sale items.
- Refunds come from completed refund items in the selected activity period.
- Net sales equal gross sales minus refunds.
- Store revenue uses approved or paid settlement snapshots only.
- Draft and reviewed settlements are excluded from finalized revenue.
- Current inventory is a present-time snapshot.

## Merchant dashboard

Merchant users see only the merchant linked to their organization membership.
Their read-only dashboard includes merchant sales, refunds, net sales, current
inventory counts, settlements, and payout status.

The backend derives merchant identity from `MerchantAccount`; client-supplied
merchant IDs and email matching do not grant access. Store-level revenue and
mixed-sale totals that could disclose another merchant's value are not returned.

## Query architecture

Reports aggregate directly from source transaction and settlement records. No
reporting warehouse, materialized reporting table, queue, or caching layer is
currently required. Queries are tenant-scoped, bounded, and read-only.

CSV exports, custom report builders, forecasting, accounting integrations, and
elaborate charting remain excluded.
