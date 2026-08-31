# Milestone 1 — SaaS and Multi-Tenant Foundation

**Status:** Completed historical summary

## Goal

Establish secure authentication, organizations, branches, memberships, initial
role-based access, and tenant isolation.

## Delivered

- NestJS and Next.js application foundations with Prisma/PostgreSQL.
- User registration, login, authenticated identity, logout, and refresh.
- Rotating refresh sessions stored hashed at rest in HTTP-only cookies.
- Account profile editing, password changing, and account deletion.
- Organizations and organization switching.
- Owner, manager, cashier, and merchant organization roles.
- Member listing, role changes, removal, and the last-owner invariant.
- Expiring organization invitation links with revocation and acceptance.
- Branch creation, listing, retrieval, and editing.
- Authenticated organization shell and role-aware navigation.
- Swagger/OpenAPI documentation in development environments.

## Important rules

- Organization access is derived from authenticated membership.
- Tenant IDs supplied by clients never bypass membership checks.
- Only owners change membership access; managers retain read-only membership
  visibility.
- An organization must always retain at least one owner.
- Branch names and optional codes are unique inside an organization.
- Password changes revoke refresh sessions.
- Account deletion preserves required business history while making credentials
  unusable.

## Security result

Passwords use bcrypt, authentication errors avoid account enumeration, refresh
tokens rotate, CORS is origin-restricted, input DTOs reject unknown fields, and
tenant-object lookups are scoped by organization.

## Explicit exclusions at completion

Merchant operations, spaces, products, inventory, POS, finance, reporting,
offline operation, and SaaS billing were outside this milestone.

## Current references

- [System overview](../architecture/system-overview.md)
- [Tenancy and security](../architecture/tenancy-and-security.md)
- [Frontend architecture](../architecture/frontend-architecture.md)
