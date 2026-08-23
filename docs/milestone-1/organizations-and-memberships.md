# Milestone 1: Organizations and Membership Foundation

## Scope

This part introduces the first tenant boundary:

- organizations
- organization membership records
- initial organization-role values
- authenticated organization creation
- listing organizations available to the authenticated user
- retrieving an organization through the authenticated user's membership

It does not implement member invitations, membership administration, role-changing endpoints, role guards, branches, store settings, platform administration, or a persisted active-organization selection.

## Data model

### `Organization`

- UUID `id`
- `name`
- `createdAt` and `updatedAt`

### `OrganizationMembership`

- composite primary key of `organizationId` and `userId`
- organization foreign key
- user foreign key
- `role`
- `createdAt` and `updatedAt`

Deleting a user or organization cascades to its membership records. No user-deletion or organization-deletion API exists in this part.

The `OrganizationRole` database enum contains:

- `OWNER`
- `MANAGER`
- `CASHIER`
- `MERCHANT`

These values establish membership data shape only. Role permissions are not enforced until the initial RBAC part is implemented. `PLATFORM_SUPERADMIN` is intentionally not an organization membership role.

The migration is `20260823000000_add_organizations_and_memberships`.

## API

All endpoints require `Authorization: Bearer <access-token>`.

### `POST /organizations`

Creates an organization and assigns the authenticated creator an `OWNER` membership in the same database transaction.

Request:

```json
{
  "name": "Concept Collective"
}
```

Names are trimmed and must contain 2–120 characters.

Response:

```json
{
  "id": "organization-uuid",
  "name": "Concept Collective",
  "role": "OWNER",
  "createdAt": "2026-08-23T00:00:00.000Z",
  "updatedAt": "2026-08-23T00:00:00.000Z"
}
```

### `GET /organizations`

Returns only organizations for which the authenticated user has a membership. Each entry includes that user's organization role.

### `GET /organizations/:organizationId`

Returns the organization only when the authenticated user has a membership. A missing organization and an organization belonging only to another user both return HTTP `404`, avoiding disclosure of another tenant's existence.

The URL identifies the organization selected for this request. The system does not yet persist an "active organization" preference or place an organization ID into the access token.

## Security and tenant isolation

- Organization creation derives the owner ID exclusively from the verified access token.
- Clients cannot supply an owner or membership user ID.
- Organization and owner-membership creation are atomic.
- Organization lists are filtered by the authenticated user's membership.
- Individual organization lookup uses the composite organization/user membership key.
- Knowing a valid organization UUID does not grant access.

These rules cover the endpoints introduced in this part. A reusable tenant context for future organization-owned domains will be added during the dedicated tenant-isolation part.

## Validation performed

- Prisma schema validation passed.
- The migration applied successfully to PostgreSQL.
- Formatting, lint, unit tests, and production build passed.
- Unit tests verify the creation transaction and membership-scoped queries.
- Integration verification confirmed:
  - authenticated organization creation returns HTTP `201`
  - creator membership is `OWNER`
  - the creator can list and retrieve the organization
  - a different authenticated user receives HTTP `404`
  - an unauthenticated request receives HTTP `401`

## Assumptions and limitations

- Any authenticated user may create an organization during the current foundation stage.
- Organization names are not globally unique because independent businesses may legitimately share a name.
- The organization-creation endpoint creates only the owner membership; subsequent membership administration is handled by the RBAC endpoints.
- Organization update and deletion are not part of this implementation.

Membership administration and initial role enforcement were subsequently added in [Initial organization RBAC](initial-rbac.md).
