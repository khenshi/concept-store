# Merchant Finance: Live Payables and Payouts

**Status:** Current reference

## Lifecycle

```text
Eligible sales, refunds, and adjustments accrue into a live payable
  → owner/manager closes the balance on schedule or early
  → source-linked draft snapshot
  → owner/manager records review
  → owner approval and lock
  → payout recorded
  → paid
```

The active workflow uses `DRAFT`, `REVIEWED`, `APPROVED`, and `PAID`. Approval
is owner-only and requires the explicit review step first.

## Calculation

```text
Gross sales
− completed refunds
= net sales
− commission
± documented adjustments
= live merchant payable

Optional rent receivable offset
= final settlement payout
```

Commission is calculated from net sales after refunds. Fixed monthly rent is a
separate merchant receivable and never reduces the live payable automatically.
During settlement preview, an owner or manager may explicitly choose to deduct
the accumulated outstanding rent. The choice defaults to off. The backend caps
the deduction at the available rent balance and merchant payable, then allocates
it to the oldest rent period first. It can never produce a negative payout.
Calculations use server-side decimal arithmetic.

## Live payable and closure

The overview is calculated directly from eligible financial activity that has
not been included in a paid settlement. It does not depend on a settlement row
existing. Every active merchant remains visible: ready accounts show their live
balance, zero-activity accounts remain at zero, and merchants without a current
agreement show an agreement-required state. The overview keeps scanning simple
with merchant, branch, period, deadline, amount due, and a link to the merchant
detail. The detail page contains the calculation breakdown, adjustments,
agreement state, and settlement action.

The live overview is paginated and calculates only the visible merchant page.
The default page size is 20 and the API caps it at 50. Settlement history is
also shown 20 rows at a time. This keeps overview requests bounded while the
merchant detail route performs the complete single-merchant calculation needed
for review and closure.

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

Each monthly rent charge retains its source month, original amount, remaining
balance, due date, status, source agreement, and transaction history. The UI
shows these periods as the breakdown beneath one accumulated balance. Direct
full or partial payments and documented adjustments are recorded against the
specific receivable. A settlement deduction is allocated oldest-first, reserved
by the draft, and applied to the rent ledger only when payout is recorded.

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

Past deadlines remain overdue until the settlement is paid. Merchant detail
distinguishes the amount due at the missed deadline from newer activity.

The live overview supports merchant and branch filters with live summary
metrics. The Merchant Finance shell separates the live overview and historical
snapshots into dedicated tabs. Manual adjustments and separately received rent
payments are entered from the Rent receivables tab; payable corrections remain
on the merchant payable detail. History has period and status filters. Historical
settlement detail includes its locked calculation, source sales and refunds,
agreement snapshot, adjustments, payout information, and append-only
lifecycle history.

## Current data model

- `MerchantSettlement` is created only when a live payable is closed. It stores
  the immutable financial totals, scheduled deadline, lifecycle actors, and
  timestamps; it has no automatic-generation metadata or accrued-rent field.
- `SettlementTermSnapshot` preserves the agreement, effective segment,
  schedule, commission/rent rates, and sales calculation used by the closure.
  It does not duplicate rent collection policy or calculated rent accrual.
- `SettlementAdjustment` stores one documented signed payable correction. A
  separate type column is unnecessary because this table contains adjustments
  only.
- `MerchantReceivable` stores one fixed-rent obligation per merchant and source
  month. It has no receivable-type column because rent is the only supported
  receivable in this milestone.
- `MerchantReceivableTransaction` retains its transaction type because payment,
  settlement deduction, and documented adjustment have different financial
  meanings.
- `SettlementReceivableAllocation` preserves rent selected for a particular
  settlement and prevents the same available balance from being consumed
  twice.

Historical settlements, agreement snapshots, payouts, receivable transactions,
allocations, and audit events remain intact. Obsolete columns were removed only
after stored data was checked for historical dependencies.
