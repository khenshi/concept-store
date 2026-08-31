# Milestone 7 — Reporting and Dashboards

**Status:** Completed historical summary

## Goal

Give owners, managers, and merchants useful visibility over sales, inventory,
settlements, payouts, and store-earned revenue without duplicating source
financial records.

## Delivered

- Owner/manager organization dashboard.
- Gross sales, refunds, net sales, finalized store revenue, settlement
  obligations, payouts, stock, and low-stock metrics.
- Filterable and paginated sales-attribution report.
- Filterable and paginated current-inventory report.
- Filterable and paginated merchant-performance report.
- Recent sales and settlement activity.
- Explicit owner-managed links between merchant-role users and merchant records.
- Read-only merchant dashboard restricted to the linked merchant.

## Important definitions

- Gross sales come from immutable completed sale items.
- Refunds use completed refund activity in the selected period.
- Net sales equal gross sales minus refunds.
- Finalized store revenue uses approved or paid settlement snapshots.
- Draft and reviewed settlements are not recognized as finalized revenue.
- Current inventory is a present-time snapshot rather than a historical period
  balance.

## Security and integrity result

Owner/manager reports remain tenant scoped and validate branch and merchant
filters. Merchant identity is derived server-side through `MerchantAccount`, not
from email or client input. Merchant responses omit store revenue and mixed-sale
totals that could expose another merchant's value.

## Explicit exclusions at completion

Exports, custom report builders, forecasting, analytics infrastructure,
accounting integrations, and elaborate charts were not introduced.

## Delivery commits

- `5719c7b` — architecture
- `38c3504` — overview API
- `1a3a06d` — operational report APIs
- `2fd5f5c` — owner reporting UI
- `58b5895` — merchant account isolation and dashboard
- `3b258e6` — completion audit

## Current reference

- [Reporting and dashboards](../workflows/reporting.md)
