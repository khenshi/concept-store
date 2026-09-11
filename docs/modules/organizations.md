# Organizations

**Status:** Implemented

## Responsibilities

- Create a concept-store organization.
- List organizations available to the authenticated user.
- Load one organization through membership-derived access.
- Switch between accessible organization workspaces.

## API

```text
POST /organizations
GET  /organizations
GET  /organizations/:organizationId
```

## Rules

- Creating an organization also creates an `OWNER` membership for the creator.
- Organization access is derived from `OrganizationMembership`; possession of
  an organization UUID does not grant access.
- An unavailable or foreign organization is returned as not found.
- Organization IDs use UUID v4 validation.

## Data

`Organization` is the tenant root. Tenant-owned modules reference its ID and
must enforce the global isolation rules in `AGENTS.md`.

## Frontend

Authenticated users can create organizations, view their available
organizations, switch workspaces, and load an organization-scoped shell.
