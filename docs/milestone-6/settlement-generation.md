# Milestone 6 Part 3: Settlement Generation

## Scope

This part adds the internal, server-authoritative service that generates and persists a merchant settlement draft.

It does not expose an HTTP endpoint, recalculate existing drafts, manage adjustments, change settlement status, record payouts, or add frontend behavior.

## Generation input

The service accepts only:

- trusted organization ID;
- merchant ID;
- authenticated calculating user ID; and
- inclusive `periodStart` and `periodEnd` business dates.

Gross sales, agreement terms, commission, rent, totals, adjustment totals, and lifecycle status are never accepted from the client.

## Period rules

- Dates use strict `YYYY-MM-DD` values.
- The period must be complete and must end before the current Philippine business date.
- The requested range must match the agreement schedule:
  - weekly: Monday–Sunday;
  - semi-monthly: 1st–15th or 16th–month-end;
  - monthly: calendar month.
- PostgreSQL independently prevents overlapping settlements for the same organization merchant.

Philippine midnight is converted to the correct UTC query boundary when selecting completed sales. This prevents transactions near midnight from entering the wrong business period.

## Agreement segmentation

Only active or ended agreements whose effective dates overlap the period are considered. Draft agreements never affect financial calculations.

Agreement coverage is divided by:

1. agreement start and end dates; and
2. each agreement's own normal settlement-period boundaries.

This supports an agreement replacement or schedule change during a requested period without applying one term to sales governed by another term. Overlapping agreement history is rejected. Any completed merchant sale that falls in an uncovered agreement gap blocks generation instead of being silently omitted or calculated without terms.

## Calculations

Each immutable `SaleItem.total` is assigned to exactly one term segment based on its Philippine completion date.

For each segment:

```text
commission = segment gross sales × commission rate
rent = fixed rent × covered calendar days ÷ normal-period calendar days
```

Commission and rent are rounded to centavos using decimal half-up rounding. Header values are sums of the rounded term values:

```text
net payout = gross sales - commission - fixed rent
```

The initial adjustment total is zero. A negative draft net payout is valid and remains explicit.

## Atomicity and security

Generation runs in a serializable transaction and:

- re-checks that the actor is a current owner or manager;
- conceals merchants outside the organization as not found;
- reads only tenant-scoped agreements and sale items;
- creates the settlement and immutable term snapshots;
- claims each included sale item through its unique settlement link; and
- returns the persisted settlement record.

Database uniqueness, exclusion constraints, and transaction conflicts become a retryable conflict response. Partial settlements or partially claimed sale items cannot be committed.

## Tests

Focused coverage verifies:

- weekly, semi-monthly, and monthly calendar boundaries;
- Philippine timestamp conversion;
- strict and ordered date input;
- multiple agreement segments;
- calendar-day fixed-rent proration;
- centavo-safe commission and total calculation;
- server-authoritative sale selection;
- actor-role revalidation;
- cross-tenant merchant concealment;
- agreement coverage gaps; and
- duplicate, exclusion, and serialization conflict handling.

## Next part

The next backend part can expose authenticated settlement creation and read APIs with DTO validation, pagination/filtering, response mapping, organization authorization, Swagger contracts, and HTTP boundary tests.

