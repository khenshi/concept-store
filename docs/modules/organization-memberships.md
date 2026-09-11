# Organization Memberships

**Status:** Implemented

## Responsibilities

- Associate users with organizations and organization roles.
- List organization members.
- Change member roles.
- Remove memberships.
- Supply organization context for tenant authorization.

## API

```text
GET    /organizations/:organizationId/members
PATCH  /organizations/:organizationId/members/:userId/role
DELETE /organizations/:organizationId/members/:userId
```

## Authorization

- `OWNER` and `MANAGER` can list members.
- Only `OWNER` can change roles or remove members.
- `CASHIER` and `MERCHANT` cannot access member management.

## Data and rules

`OrganizationMembership` uses the composite key `(organizationId, userId)` and
stores one of `OWNER`, `MANAGER`, `CASHIER`, or `MERCHANT`.

- Every organization must retain at least one owner.
- A role change or removal that would remove the final owner is rejected.
- Organization access is derived from the authenticated user's membership.
- Foreign organizations and members are not disclosed.

## Frontend

Owners and managers receive the Members navigation entry and member list.
Owner-only controls change roles and remove members with confirmation.
