# Milestone 6 Security Audit

## Result

The initial Merchant Finance backend passes its security review and is suitable for frontend integration.

## Verified controls

- Every route requires authentication and organization membership; cashier and merchant roles are excluded.
- Settlement reads and mutations use the authenticated organization context and conceal cross-tenant identifiers.
- Financial mutations recheck the actor's current membership and role inside serializable transactions.
- Only owners can approve settlements or record payouts; managers can prepare and review drafts.
- Gross sales, agreement terms, deductions, adjustment totals, net payout, payout amount, actor identity, and lifecycle status remain server-authoritative.
- Sale-item uniqueness and tenant-safe composite relations prevent duplicate or cross-tenant attribution.
- Overlapping merchant settlement periods are blocked by a PostgreSQL exclusion constraint.
- Conditional lifecycle updates and serializable retry conflicts prevent stale transitions and duplicate payouts.
- Approved and paid settlements have no edit, recalculate, adjustment, return, or delete path.
- Monetary values use exact decimals and database checks protect calculation totals and positive payout amounts.

## Residual risks

- Refunds and voids will require explicit post-finalization correction rules; finalized source history must not be rewritten.
- Merchant finance access remains intentionally disabled until users are securely linked to merchant records.
- Deployment monitoring for repeated conflicts, unusual adjustments, and payout-reference reuse belongs to a later operational/reporting scope.
- The database cannot express the cross-table rule that every `PAID` settlement has a payout in a simple check constraint; the application guarantees it through one atomic transaction and restrictive API surface.
