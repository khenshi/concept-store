# Current implementation plan

Plan 20, [Space-type maintenance and occupancy actor privacy](pending/20-spaces-maintenance-privacy.md),
is approved and active for implementation as of November 3, 2026. Plans 17 and
18 remain implemented with their manual and deployment verification deferred.

The configured development Neon database also had an explicitly approved Plan
08 migration-recovery slice: preserve its three existing sales and one refund
while applying the payment-account schema. It completed successfully on
November 6, 2026 with exact payment snapshots and source totals verified. Do
not reset, delete, rewrite, or replay financial records in future recoveries;
stop if a preservation backfill cannot prove the same invariants.

The scope is limited to Owner-managed space-type rename/archive/reactivation and
backend-enforced Merchant occupancy actor privacy. Preserve existing spaces,
occupancy history, permissions and current-label behavior. Do not add deletion,
type merging, automatic occupancy release, a generic catalog abstraction, lease
billing, a global audit system or new infrastructure. Plans 16 and 08 remain
completed; Plan 14 remains the STAGING-ONLY release record; Plan 13
legal/privacy/retention decisions and Plan 12 deferred gates remain excluded.
