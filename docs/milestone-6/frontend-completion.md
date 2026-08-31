# Milestone 6 Frontend Completion

## Implemented workflows

Owners and managers now have a permanent **Settlements** organization destination with:

- a settlement register filtered by merchant and lifecycle status;
- explicit draft generation using merchant and closed-period dates;
- settlement detail with totals, agreement-term segments, and attributed sales;
- draft recalculation and signed adjustment creation/removal;
- review and return-to-draft actions for owners and managers;
- owner-only approval and payout recording; and
- immutable approved and paid views with recorded payout details.

The revised overview additionally provides summary metrics, merchant/branch/period/status filters, net sales, deductions, amount due, and off-cycle generation. Settlement detail includes attributed refunds and the append-only action history.

The client never submits calculated totals, agreement terms, merchant attribution, payout amount, actor identity, or lifecycle status. Backend responses remain authoritative after every mutation.

## Authorization behavior

The navigation exposes finance only to owners and managers. Owner-only approval and payout controls are hidden from managers. These checks improve usability; backend guards and in-transaction role validation remain the security boundary.

## Validation

- Frontend TypeScript and ESLint pass.
- 39 Vitest files and 121 tests pass.
- The Next.js production build passes.
- Focused tests cover organization-scoped API routing, dedicated lifecycle/payout endpoints, adjustment validation, non-cash payout references, and finance navigation visibility.
