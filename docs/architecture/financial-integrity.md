# Financial Integrity

**Status:** Current reference

Sales, refunds, settlements, and payouts are financially sensitive and remain
server-authoritative.

## Money

- PostgreSQL numeric/decimal columns and Prisma decimals are used for money.
- Floating-point arithmetic is not used for authoritative calculations.
- API money values are serialized as fixed two-decimal strings.
- The backend derives sale totals from current products and settlement totals
  from immutable transaction records and agreement terms.

## Historical meaning

- Sale items snapshot product, merchant, quantity, and price information.
- Settlement term snapshots preserve the agreements used for each calculation.
- Approved settlements are locked and are not recomputed from mutable current
  agreements.
- Payable adjustments and rent receivable transactions are separate records.
  Rent payments reduce a specific monthly receivable; optional settlement
  offsets are reserved at draft creation and applied only with payout.
- Fixed rent is not accrued inside a settlement. Its monthly obligation exists
  only in the rent receivable ledger, avoiding duplicate rent balances and
  calculation paths.
- Direct rent payments may record a full or partial amount against one monthly
  receivable. A settlement may apply an explicit full or partial amount to each
  available receivable, up to its unreserved balance and the merchant payable.
- Accrued rent is the sum of original monthly receivable charges, collected rent
  is full `PAYMENT` plus applied settlement deductions, and outstanding rent is
  the remaining receivable balance. These views are kept separate.
- Refund, approval, payout, and settlement lifecycle actions retain actor and
  timestamp history.

## Transaction boundaries

Database transactions protect operations that must succeed or fail together,
including:

- checkout, payment recording, inventory deduction, and movement creation;
- refund creation and returned-stock movements;
- live payable closure, pending-adjustment capture, and source linking;
- settlement lifecycle transitions; and
- payout recording.

Serializable isolation or concurrency checks are used where competing writes
could duplicate or invalidate financial state.

## Database connections

The running backend reads `DATABASE_URL` and uses the provider's pooled
PostgreSQL endpoint with bounded pool and timeout settings. Prisma CLI migration
commands read `DIRECT_DATABASE_URL` so schema changes use a direct session
connection. In production, the direct migration credential should be available
only to the deployment/migration job, not to the long-running API process.

For Neon, the pooled hostname normally contains `-pooler`; the corresponding
direct hostname does not. Both URLs must target the same database and schema.
Neither connection string may be exposed to the frontend.

## Revenue distinction

Gross customer sales are not store revenue.

- Merchant gross sales belong to merchants before deductions.
- Store-earned revenue consists of finalized commission, deducted rent, and the
  effect of finance adjustments. Separately paid rent is not recognized again
  through a payout deduction.
- Reporting recognizes these values from approved or paid settlement snapshots,
  not from open live balances or draft settlements.

## Idempotency and immutability

Online checkout uses a client transaction ID to prevent duplicate sales during
retries. Settlement source links prevent activity from being paid twice, and a
merchant cannot open another closure while one is unpaid. Finalized financial
records are corrected through explicit follow-up actions rather than silent
mutation.

Completed sales are never edited. An owner or manager may void an eligible sale
with a reason; one serializable transaction restores inventory, records reversal
movements, and writes the immutable void audit fields. Refunded or settlement-
linked sales are rejected, and all live financial calculations exclude voided
activity.

## Payable projection and reconciliation

`MerchantFinanceAccrual` is a derived, repairable projection of completed and
currently unreleased merchant sale/refund activity. Sales and refunds remain the
authority. Checkout, eligible void, refund, draft closure, and draft cancellation
maintain the affected buckets inside their existing serializable transactions.
Paid settlement source links remain boundaries and are never reopened by a
backfill.

Finance live rows, organization-wide summary, and closure previews read these
bounded projection buckets. Draft closure recalculates the linked sale/refund
sources authoritatively inside its serializable transaction. If those totals do
not match the projection, the backend rebuilds that merchant's projection and
returns a stale-preview conflict instead of creating a settlement.

Run reconciliation from `backend/`:

```text
npm run finance:reconcile
npm run finance:reconcile -- --organization <organization-id>
npm run finance:reconcile -- --repair
npm run finance:reconcile -- --repair --organization <organization-id>
```

Report mode is the default and performs no persistent writes. It reports gross
sales, refunds, commission, payable differences, and differing bucket counts per
merchant. `BLOCKED` means historical activity cannot be attributed to exactly
one effective agreement; correct that source/agreement history before repair.

Repair mode locks and rebuilds one merchant at a time from completed, currently
unreleased sale and refund items. It only replaces projection rows. It does not
modify sales, refunds, agreements, settlement snapshots, source links, payouts,
rent receivables, or receivable history. The operation is idempotent; rerun
report mode afterward and require zero drift and zero blocked merchants before
switching live reads to the projection.

If repair is interrupted, rerun the same command. Each merchant rebuild has its
own transaction, and already-completed merchants will report as matching. If a
runtime projection update fails, its enclosing checkout/refund/settlement
transaction rolls back; investigate the source error, then use report mode
before choosing explicit repair.
