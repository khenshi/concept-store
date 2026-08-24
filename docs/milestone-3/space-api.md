# Milestone 3: Space CRUD API

## Scope

This part exposes authenticated, tenant-scoped management for physical spaces. Owners and managers can create, list, retrieve, and update spaces.

Space assignments, agreement APIs, frontend screens, deletion, and Milestone 4 functionality are not included.

## Routes

```text
POST  /organizations/:organizationId/branches/:branchId/spaces
GET   /organizations/:organizationId/branches/:branchId/spaces
GET   /organizations/:organizationId/spaces/:spaceId
PATCH /organizations/:organizationId/spaces/:spaceId
```

The create and list routes are nested under a branch because their operating context is branch-specific. Detail and update routes use the stable space identifier while every service query still includes the trusted organization identifier.

## Authorization

All routes require:

- a valid access token
- stored membership in the route organization
- an `OWNER` or `MANAGER` organization role

Cashiers and merchant-role members receive forbidden. A user without organization membership receives not found so another tenant's existence is not disclosed.

The organization identifier used by the service comes from the authorization guard's stored membership context, not from request-body data.

## Create behavior

Required fields:

- `code`
- `name`
- `type`

Optional fields:

- `customType`, accepted only for `CUSTOM`
- `status`, defaulting to `ACTIVE`

Codes are trimmed and normalized to uppercase. Names and custom descriptions are trimmed.

The service verifies the branch using both `branchId` and `organizationId` before creating the space. A branch from another organization is reported as unavailable.

## Custom type rule

- `CUSTOM` requires a nonblank `customType`.
- Predefined types reject a custom description.
- Changing a custom space to a predefined type clears its old custom description.

The service enforces this rule for useful API errors, while the PostgreSQL check constraint remains the final integrity layer.

## Listing and retrieval

Branch lists are ordered deterministically by name, code, and identifier. Both active and inactive spaces are returned so operational history and configuration remain visible.

Space detail lookup always includes the trusted `organizationId`. Guessing a valid space identifier from another tenant returns not found.

## Update behavior

Updates are partial and accept:

- `code`
- `name`
- `type`
- `customType`
- `status`

An empty update is rejected. Branch ownership cannot be changed through the update endpoint; moving a physical space between branches would alter assignment history and is not supported.

Spaces are not hard-deleted. Setting a space to `INACTIVE` preserves its identity and future assignment history.

## Conflict handling

The database guarantees code uniqueness inside each branch. Concurrent duplicate codes are mapped from Prisma `P2002` errors to an HTTP conflict response.

The same code may be used in different branches.

## Swagger

The routes are grouped under `spaces`. Swagger documents request validation, `SpaceType`, `SpaceStatus`, the response schema, authentication, authorization errors, unavailable records, and code conflicts.

## Validation

- backend production build
- ESLint
- 65 unit tests, including nine space-service tests
- API-boundary e2e tests for authentication, tenant concealment, role authorization, normalization, validation, and OpenAPI publication
- Prettier formatting check
- Git whitespace validation

## Explicit exclusions

- no assignment creation or ending
- no occupancy response projection
- no agreement behavior
- no deletion endpoint
- no frontend implementation
