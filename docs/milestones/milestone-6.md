# Milestone 6 — Merchant Finance

**Status:** Completed historical summary

## Goal

Replace manual merchant remittance calculations with scheduled, reviewable,
auditable settlements and payout recording.

## Delivered

- Settlement periods based on merchant agreement schedules.
- Automatic idempotent generation and missed-period catch-up.
- Gross sales, completed refunds, net sales, commission, rent, adjustments, and
  amount-due calculations.
- Agreement-term snapshots and source sale/refund links.
- Draft recalculation and documented signed adjustments.
- Draft, reviewed, approved, and paid lifecycle.
- Owner-only approval and payout recording.
- Locked approved settlement history and append-only audit events.
- Exceptional off-cycle settlements with documented reasons.
- Filtered overview, summary metrics, detailed calculation breakdown, source
  transactions, payout information, and lifecycle history.

## Authoritative calculation

```text
Gross sales − refunds − commission − fixed rent ± adjustments = amount due
```

Commission is calculated after refunds. Fixed rent follows the snapshotted
agreement segments and is prorated where necessary.

## Important rules

- Scheduled periods must be closed before generation.
- A source sale or refund item cannot be settled twice.
- Drafts may change; approved and paid settlements cannot be silently
  recalculated.
- Owners and managers review; only owners approve and record payouts.
- One payout records the exact approved amount.
- Off-cycle settlements do not duplicate normal fixed-rent charges.

## Security and integrity result

All calculations are server-authoritative and decimal-safe. Financial lifecycle
changes use transactions and preserve actors, reasons, timestamps, source
records, and tenant-scoped relationships.

## Current references

- [Settlements and payouts](../workflows/settlements-and-payouts.md)
- [Financial integrity](../architecture/financial-integrity.md)
