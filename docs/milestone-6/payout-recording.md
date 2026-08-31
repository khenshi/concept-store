# Milestone 6 Part 7: Payout Recording

## Scope

This part records one external/manual payout for a positive approved settlement and atomically advances it from `APPROVED` to `PAID`.

It does not initiate bank transfers, split payouts, carry negative balances forward, edit payout history, or add frontend behavior.

## API

```text
POST /organizations/:organizationId/settlements/:settlementId/payout
```

Only an organization owner may use this route. The request contains:

- `method`: `CASH`, `GCASH`, `BANK_TRANSFER`, or `OTHER`;
- `referenceNumber`, required for every non-cash method;
- optional `note`; and
- an ISO 8601 `paidAt` timestamp that cannot be in the future.

The request cannot provide an amount, merchant, organization, actor, or lifecycle status. The service copies the exact positive `netPayout` from the approved settlement and derives all identities from persisted and authenticated context.

## Transaction and integrity rules

Payout recording runs in a serializable transaction. The service:

1. rechecks that the current actor remains an owner of the organization;
2. loads the settlement through the trusted organization scope;
3. requires `APPROVED` status and a positive `netPayout`;
4. conditionally changes the status to `PAID`;
5. creates the immutable payout using the settlement amount; and
6. returns the updated settlement detail.

The status change and payout insert succeed or fail together. Conditional status mutation, the one-payout unique constraint, and serializable conflict handling prevent duplicate payouts and stale retries. Unknown and cross-organization IDs remain concealed.

Zero and negative settlements may be approved but cannot be paid. Any balance carried into a later period must remain an explicit later adjustment.

## Validation

Unit and HTTP tests cover server-authoritative amount copying, owner revalidation, manager denial, positive-net enforcement, lifecycle enforcement, tenant concealment, future-date rejection, non-cash reference validation, unknown-field rejection, and OpenAPI publication.
