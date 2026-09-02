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
- Rent offsets are capped by both the available receivable balance and merchant
  payable, so settlements cannot produce negative payouts.
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
