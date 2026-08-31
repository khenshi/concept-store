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
- Adjustments are explicit signed records with documented reasons.
- Refund, approval, payout, and settlement lifecycle actions retain actor and
  timestamp history.

## Transaction boundaries

Database transactions protect operations that must succeed or fail together,
including:

- checkout, payment recording, inventory deduction, and movement creation;
- refund creation and returned-stock movements;
- settlement generation and source linking;
- settlement lifecycle transitions; and
- payout recording.

Serializable isolation or concurrency checks are used where competing writes
could duplicate or invalidate financial state.

## Revenue distinction

Gross customer sales are not store revenue.

- Merchant gross sales belong to merchants before deductions.
- Store-earned revenue consists of finalized commission, fixed rent, and the
  effect of settlement adjustments.
- Reporting recognizes these values from approved or paid settlement snapshots,
  not from draft or reviewed settlements.

## Idempotency and immutability

Online checkout uses a client transaction ID to prevent duplicate sales during
retries. Scheduled settlement generation uses deterministic keys to prevent
duplicate periods. Finalized financial records are corrected through explicit
follow-up actions rather than silent mutation.
