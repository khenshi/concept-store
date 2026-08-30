# Milestone 6 Part 6: Settlement Review and Approval

## Scope

This part adds explicit lifecycle actions for reviewing a draft settlement, returning a reviewed settlement to draft for correction, and approving a reviewed settlement.

It does not record payouts, mark settlements paid, add frontend behavior, or permit changes to approved financial history.

## Lifecycle

The supported transitions in this part are:

```text
DRAFT ──review──> REVIEWED ──approve──> APPROVED
  ↑                  │
  └──return to draft─┘
```

- `DRAFT → REVIEWED` records `reviewedById` and `reviewedAt`.
- `REVIEWED → DRAFT` clears review metadata so the draft can be recalculated or adjusted and reviewed again.
- `REVIEWED → APPROVED` records `approvedById` and `approvedAt` while preserving the review metadata.
- Transitions cannot be skipped or repeated.
- Approved settlements remain immutable. Corrections after approval must be represented in a later settlement rather than rewriting history.

## API

| Method | Route                                                                      | Allowed roles  |
| ------ | -------------------------------------------------------------------------- | -------------- |
| `POST` | `/organizations/:organizationId/settlements/:settlementId/review`          | Owner, manager |
| `POST` | `/organizations/:organizationId/settlements/:settlementId/return-to-draft` | Owner, manager |
| `POST` | `/organizations/:organizationId/settlements/:settlementId/approve`         | Owner only     |

Each successful action returns the updated settlement detail and uses `200 OK`. Lifecycle status and actor IDs are never accepted from the request body.

## Security and consistency

Every lifecycle action runs in a serializable database transaction. The service:

- derives the organization and actor from authenticated context;
- revalidates current organization membership and the required role inside the transaction;
- conceals missing and cross-organization settlement IDs;
- checks the current persisted status;
- conditionally updates from the expected status only; and
- rejects concurrent or stale transitions with a conflict response.

Approval is guarded twice: the controller permits only owners, and the service independently rechecks that the actor is still an owner. A role change between the HTTP authorization check and the financial transaction therefore cannot grant stale approval authority.

The database lifecycle constraint independently requires the correct review and approval metadata for every persisted status.

## Validation

Unit and HTTP-boundary tests cover valid transitions, owner-only approval, in-transaction role revalidation, skipped transitions, tenant concealment, trusted actor forwarding, and OpenAPI route publication.
