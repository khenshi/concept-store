# Settlements and Payouts

**Status:** Current reference

## Lifecycle

```text
Sales and refunds
  → settlement period closes
  → draft generated
  → owner/manager review and adjustments
  → owner approval and lock
  → payout recorded
  → paid
```

Statuses are `DRAFT`, `REVIEWED`, `APPROVED`, and `PAID`.

## Calculation

```text
Gross sales
− completed refunds
= net sales
− commission
− fixed rent
± documented adjustments
= amount due
```

Commission is calculated from net sales after refunds. Fixed rent is derived
from agreement segments and prorated where terms cover only part of the period.
Calculations use server-side decimal arithmetic.

## Generation

Scheduled settlements are generated automatically after weekly, semi-monthly,
or monthly periods close. Deterministic generation keys make catch-up safe and
idempotent.

Owners can recover a missing scheduled draft manually. Exceptional off-cycle
drafts require a documented reason and do not duplicate normal fixed-rent
charges.

## Review and adjustments

Draft settlements may be recalculated while preserving explicit adjustments.
Adjustments are signed amounts with mandatory reasons and actor history. Owners
and managers can review or return a reviewed settlement to draft.

Only owners can approve. Approval snapshots and locks the calculation so later
agreement or transaction edits cannot silently change it.

## Payouts

Only approved settlements can receive a payout. One manual payout record stores
the exact approved amount, method, optional reference/note, payment date, and
recording owner. Successful recording changes the settlement to `PAID` in the
same transaction.

Automatic bank payouts and accounting integrations are not implemented.

## Visibility and audit

The settlement overview supports merchant, branch activity, period, and status
filters with summary metrics. Detail includes calculation breakdown, source
sales and refunds, agreement snapshots, adjustments, payout information, and an
append-only lifecycle history.
