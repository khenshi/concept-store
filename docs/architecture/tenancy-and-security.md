# Tenancy and Security

**Status:** Current reference

## Tenant boundary

Every business request is scoped to an authenticated organization membership.
The backend derives the user identity from authentication and verifies the
route's organization ID before executing business logic.

- Tenant-owned records carry `organizationId` directly or through a protected
  composite relationship.
- Entity IDs supplied by clients are never sufficient authorization.
- Branch and merchant filters are checked inside the active organization.
- Cross-organization identifiers return not found or forbidden responses
  without revealing foreign records.

## Roles

Initial organization roles are:

- `OWNER`: full organization administration and financial approval;
- `MANAGER`: operational management and financial review;
- `CASHIER`: POS access;
- `MERCHANT`: read-only access to the explicitly linked merchant; and
- `PLATFORM_SUPERADMIN`: reserved platform-level role outside organization
  operations.

Frontend visibility is a usability measure. Backend guards and service-level
checks remain the security boundary.

## Merchant identity

A merchant-role membership is linked explicitly to one merchant record through
`MerchantAccount`. Email matching is never used to infer merchant ownership.
The link uses tenant-scoped foreign keys, can be managed only by owners, and is
removed when the member no longer has the merchant role.

## Authentication and sessions

- Passwords are hashed with bcrypt.
- Login failures do not reveal whether an account exists.
- Access tokens are short lived.
- Refresh tokens are random, rotated, stored hashed at rest, and transported in
  HTTP-only cookies.
- Password changes revoke active refresh sessions.
- Account deletion anonymizes credentials while retaining business history
  that must remain auditable.

## Input and HTTP protections

- DTO validation uses whitelisting and rejects unexpected fields.
- UUIDs, enums, dates, lengths, and numeric bounds are validated.
- CORS is restricted to the configured frontend origin.
- Helmet security headers and application rate limiting are enabled.
- Financial values, roles, tenant IDs, prices, and calculated totals supplied
  by the frontend are not trusted.

## Security maintenance

New modules must include role checks, tenant-scoped queries, object-level
authorization, and tests for foreign organization identifiers. Security fixes
belong in the milestone that introduces the affected behavior rather than a
future cleanup phase.
