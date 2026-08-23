# Milestone 1: Initial Organization RBAC

## Scope

This part adds initial role-based authorization and membership administration inside an organization:

- trusted organization context derived from authenticated membership
- reusable organization-role metadata and access guard
- organization member listing
- adding an existing user as a member
- changing a member's role
- removing a member
- protection of the last-owner invariant

It does not implement platform-superadmin behavior, invitations, pending memberships, custom permissions, branch assignments, merchant-profile authorization, organization update/delete operations, or a global active-organization preference.

## Role matrix

| Operation | Owner | Manager | Cashier | Merchant |
| --- | --- | --- | --- | --- |
| List organization members | Allowed | Allowed | Denied | Denied |
| Add an existing user | Allowed | Denied | Denied | Denied |
| Change a member role | Allowed | Denied | Denied | Denied |
| Remove a member | Allowed | Denied | Denied | Denied |

`PLATFORM_SUPERADMIN` is not an organization role and is not implemented by this part.

## Authorization flow

Nested organization endpoints run two guards in order:

1. The authentication guard verifies the JWT and establishes the user identity.
2. The organization access guard validates the URL organization ID, looks up the membership using both `organizationId` and authenticated `userId`, establishes trusted organization context, and enforces role metadata.

The trusted context contains:

```text
organizationId
userId
role
```

Controllers use this server-derived context rather than trusting organization or user ownership supplied in request bodies.

Membership administration is organized as a nested `organizations/memberships` feature. It remains part of the organization domain rather than becoming a separate top-level module, while its controllers, services, DTOs, response types, and tests stay isolated from core organization creation and lookup.

Access failures deliberately distinguish:

- HTTP `404` when the user has no membership, hiding whether another tenant exists
- HTTP `403` when the user is a member but their role cannot perform the operation
- HTTP `400` when the organization ID is not a valid UUID

## API

All endpoints require `Authorization: Bearer <access-token>`.

### `GET /organizations/:organizationId/members`

Available to `OWNER` and `MANAGER`. Returns:

```json
[
  {
    "id": "user-uuid",
    "email": "member@example.com",
    "role": "MANAGER",
    "joinedAt": "2026-08-23T00:00:00.000Z"
  }
]
```

Password hashes and unrelated user information are never selected or returned.

### `POST /organizations/:organizationId/members`

Available to `OWNER` only. The user must already have an account.

```json
{
  "email": "member@example.com",
  "role": "MANAGER"
}
```

Emails are normalized to lowercase. An unknown user returns `404`; an existing membership returns `409`.

### `PATCH /organizations/:organizationId/members/:userId/role`

Available to `OWNER` only.

```json
{
  "role": "OWNER"
}
```

The role must be `OWNER`, `MANAGER`, `CASHIER`, or `MERCHANT`. A member outside the organization returns `404`.

### `DELETE /organizations/:organizationId/members/:userId`

Available to `OWNER` only. A successful removal returns HTTP `204`.

## Last-owner invariant

An organization must retain at least one `OWNER`. Demoting or removing the only owner returns HTTP `409`.

Role changes and membership removals execute in PostgreSQL `SERIALIZABLE` transactions. This prevents concurrent requests from both observing multiple owners and leaving the organization without one. A serialization conflict returns HTTP `409` with an instruction to retry.

Ownership transfer is supported by first promoting another member to `OWNER`, then demoting or removing the previous owner.

## Validation performed

- Formatting and ESLint passed.
- All 26 unit tests passed.
- The production build passed.
- Guard tests cover trusted context, missing membership, insufficient role, and invalid organization IDs.
- Service tests cover safe member projection, member addition, missing users, serializable role updates, missing members, and last-owner protection.
- PostgreSQL integration verification confirmed:
  - owner member administration
  - manager list access and mutation denial
  - cashier denial
  - duplicate membership conflict
  - last-owner demotion conflict
  - safe ownership transfer
  - cross-organization `404`
  - successful member removal

## Assumptions and limitations

- Users must register before an owner can add them; email invitation delivery is not implemented.
- Owners may promote another member to `OWNER`.
- Managers receive read-only membership visibility.
- Roles apply organization-wide. Branch-specific staff assignments are deferred to the branches part.
- Access tokens do not contain organization roles; current membership is checked in PostgreSQL for each protected organization request so role changes take effect immediately.
