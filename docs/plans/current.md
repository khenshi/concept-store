# Plan 08: Payment Account Management and Reporting

Status: Approved for implementation by the user October 25, 2026.

Implement the complete scope and acceptance contract in
[Plan 08](pending/finance-reconciliation.md). This approval supersedes its
planning-only status. Preserve existing Plan 07 work and unrelated edits.

Deliver Owner-managed tenant payment accounts, immutable system Cash, atomic
branch assignment and availability enforcement, account-linked sale/refund
snapshots, dynamic POS/refund/history selections, and exact account reporting
with Received/Refunded/Net Received controls and a signed negative-net chart.
One account per sale/refund; split payments and reconciliation remain excluded.

Use currently applicable zero-value accounts plus all historically contributing
accounts in reports; disabled zero-only accounts remain discoverable in Owner
management. Return complete grouped account totals; paginate rendered tables
at 15. No truncation of financial totals.

Prepare and rehearse the forward migration on an explicitly disposable local
database. Do not reset deployed databases until their exact developmental target
and replacement dataset are verified. Existing development reset authorization
does not apply to an unexpected or real-data target.

Completion requires backend/frontend contract parity, tenant and branch checks,
Cash constraints, exact financial aggregates, replay/race coverage, updated
module docs, relevant automated gates and separately recorded hosted/browser
cutover evidence. Keep this plan active until required work is complete.
