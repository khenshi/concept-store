# Merchant Finance: Live Payables and Payouts

**Status:** Current reference

## Lifecycle

```text
Eligible sales, refunds, and adjustments accrue into a live payable
  → owner/manager closes the balance on schedule or early
  → source-linked draft snapshot
  → owner approval and lock
  → payout recorded
  → paid
```

The active workflow uses `DRAFT`, `APPROVED`, and `PAID`. Historical
`REVIEWED` records remain readable and can still be approved.

## Calculation

```text
Gross sales
− completed refunds
= net sales
− commission
− rent deducted under the agreement policy
± documented adjustments
= amount due
```

Commission is calculated from net sales after refunds. Rent accrues daily for
visibility, while its payout deduction follows the agreement:

- `DEDUCT_FROM_PAYOUT` is an explicit opt-in. On every settlement, direct rent
  payments are applied first and only the remaining accrued rent is deducted.
- `PAID_SEPARATELY` shows accrued rent but does not reduce the merchant payout.

New agreements default to separate rent collection. Commission remains an
automatic deduction from net sales. Calculations use server-side decimal
arithmetic.

## Live payable and closure

The overview is calculated directly from eligible financial activity that has
not been included in a paid settlement. It does not depend on a settlement row
existing. Every active merchant remains visible: ready accounts show their live
balance, zero-activity accounts remain at zero, and merchants without a current
agreement show an agreement-required state. The overview shows gross sales,
refunds, commission, prorated rent, documented adjustments, amount due,
configured/activity branches, agreement schedule, and next deadline.

Closing the payable creates a source-linked draft snapshot in a serializable
transaction. Owners and managers may close early. The snapshot records both the
actual closure date and its scheduled deadline. Until payout, that snapshot
remains part of the live amount and no second closure is allowed.

After payout, its linked activity is excluded. The next deadline advances from
the prior scheduled deadline—not the early payout date—so a weekly December 8
deadline paid on December 5 advances to December 15.

## Adjustments and rent payments

Adjustments are signed amounts with mandatory reasons and actor history. They
accrue before closure and are attached atomically to the snapshot.

Direct rent payments to the owner are recorded separately for visibility and
audit. They reduce accrued rent still collectible. When agreement terms opt in
to payout deduction, only unpaid rent is deducted from the settlement.

Owners and managers can inspect and close the live payable. Only owners can
approve. Approval locks the snapshot so later agreement or transaction edits
cannot silently change it.

## Payouts

Only approved settlements can receive a payout. One manual payout record stores
the exact approved amount, method, optional reference/note, payment date, and
recording owner. Successful recording changes the settlement to `PAID` in the
same transaction.

Automatic bank payouts and accounting integrations are not implemented.

## Visibility and audit

The live overview supports merchant and branch filters with live summary
metrics. The Merchant Finance shell separates the live overview and historical
snapshots into dedicated tabs. Manual adjustments and separately received rent
payments are entered contextually from a merchant's live row rather
than presented as a primary workflow. History has period and status filters.
Detail includes calculation breakdown, source
sales and refunds, agreement snapshots, finance entries, payout information,
and an append-only lifecycle history.
