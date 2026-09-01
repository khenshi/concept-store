# Milestone 6 — Merchant Finance

**Status:** Completed historical summary

## Goal

Replace manual merchant finance tracking with live accrued payables, auditable
settlement closures, and payout recording.

## Delivered

- Settlement periods based on merchant agreement schedules.
- Live accrued payables independent of settlement records.
- Gross sales, completed refunds, net sales, commission, rent, adjustments, and
  amount-due calculations.
- Agreement-term snapshots and source sale/refund links.
- Early or scheduled closure into source-linked snapshots and documented signed
  adjustments.
- Draft, approved, and paid lifecycle. Legacy reviewed records remain readable.
- Owner-only approval and payout recording.
- Locked approved settlement history and append-only audit events.
- Deadlines that advance on the agreement cadence even after an early payout.
- Filtered overview, summary metrics, detailed calculation breakdown, source
  transactions, payout information, and lifecycle history.

## Authoritative calculation

```text
Gross sales − refunds − commission − fixed rent ± adjustments = amount due
```

Commission is calculated after refunds. Fixed rent follows the snapshotted
agreement segments and is prorated where necessary.

## Important rules

- A live payable can be closed early; only one unpaid closure may exist per
  merchant.
- A source sale or refund item cannot be settled twice.
- Finance entries may be changed while still live; approved and paid
  settlements cannot be silently recalculated.
- Owners and managers inspect and close; only owners approve and record payouts.
- One payout records the exact approved amount.
- Paid source activity is excluded from subsequent live balances.

## Security and integrity result

All calculations are server-authoritative and decimal-safe. Financial lifecycle
changes use transactions and preserve actors, reasons, timestamps, source
records, and tenant-scoped relationships.

## Current references

- [Settlements and payouts](../workflows/settlements-and-payouts.md)
- [Financial integrity](../architecture/financial-integrity.md)
