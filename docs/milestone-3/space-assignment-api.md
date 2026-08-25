# Milestone 3: Space Assignment API

## Scope

This part adds authenticated APIs for assigning merchants to physical spaces, listing assignment history, and explicitly ending a current assignment.

It does not add merchant agreements, rent or commission calculations, settlement behavior, frontend screens, scheduled future assignments, or historical date-range overlap handling.

## Endpoints

All routes require a valid access token and an `OWNER` or `MANAGER` membership in the organization identified by the route.

| Method  | Route                                                                | Behavior                              |
| ------- | -------------------------------------------------------------------- | ------------------------------------- |
| `POST`  | `/organizations/:organizationId/spaces/:spaceId/assignments`         | Create a current assignment           |
| `GET`   | `/organizations/:organizationId/spaces/:spaceId/assignments`         | List current and historical occupancy |
| `PATCH` | `/organizations/:organizationId/space-assignments/:assignmentId/end` | End a current assignment              |

The create body requires `merchantId` and `startDate`. The end body requires `endDate`. Business dates use strict `YYYY-MM-DD` input and are persisted as PostgreSQL `DATE` values.

Assignment responses include the assignment identifiers and dates plus a small merchant summary (`id`, `name`, and `code`) so clients can display history without another merchant lookup.

## Business rules

- The target space must belong to the authorized organization.
- Only an `ACTIVE` space can receive a new assignment.
- The merchant must already participate in the space's branch through `MerchantBranch`.
- A space can have at most one assignment whose `endDate` is null.
- Ending an assignment preserves its row and sets its effective `endDate`.
- An ended assignment cannot be ended again.
- `endDate` cannot precede `startDate`.
- Full historical range-overlap validation remains deferred because this API does not schedule future or already-ended assignments.

The service checks current occupancy for a useful API error. PostgreSQL's partial unique index on current assignments remains the final concurrency-safe constraint, and racing insert failures are mapped to the same conflict response.

Assignment creation and merchant branch-participation replacement use serializable transactions so a concurrent branch removal cannot create an assignment without current participation.

Ending uses a conditional update so concurrent requests cannot overwrite an already-recorded end date.

## Tenant isolation

Organization IDs are accepted only as guarded route context. Every space, assignment, and branch-participation lookup includes the trusted organization ID. A valid identifier belonging to another tenant is returned as unavailable rather than disclosed.

The assignment's `branchId` is derived from the trusted space record; it is never accepted from the client. Composite foreign keys enforce organization, branch, merchant, and space consistency in PostgreSQL. Current `MerchantBranch` participation is checked by the service at creation time and can later be removed without destroying assignment history once no current assignment remains.

## Module structure

Assignment files are nested under `src/modules/spaces/space-assignments/` because assignments govern physical-space occupancy. DTOs validate create and end commands, the controller handles transport and authorization, and the service owns tenant-scoped business rules.

## Validation

Run from `backend/`:

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run format:check
```
