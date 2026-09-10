# Tenancy and Security

**Status:** Current foundation reference

Every organization request requires an authenticated user and a matching
`OrganizationMembership`. Client-supplied organization and entity IDs never
grant access by themselves. Branch lookups include the active organization
scope, and foreign organization identifiers do not reveal records.

## Roles

- `OWNER`: manages branches, members, roles, and invitations.
- `MANAGER`: manages branches and may view organization members.
- `CASHIER`: may access the organization and read its branches.
- `MERCHANT`: remains a foundation membership role and may read organization
  and branch information; it is not linked to a merchant record.

An organization must retain at least one owner. Only owners can change member
roles, remove members, create invitations, or revoke invitations. Managers have
read-only membership visibility.

## Authentication and invitations

- Passwords are hashed with bcrypt and login errors avoid account enumeration.
- Access tokens are short lived; refresh tokens rotate, use HTTP-only cookies,
  and are stored hashed.
- Password changes revoke active refresh sessions.
- Account deletion requires the password, protects sole owners, removes active
  memberships and sessions, and anonymizes credentials.
- Invitation tokens are random and stored hashed. Invitations expire, can be
  revoked, require the invited email, and are accepted transactionally once.

DTO whitelisting, UUID validation, CORS restrictions, security headers, rate
limiting, and cross-tenant tests remain required for every future milestone.
