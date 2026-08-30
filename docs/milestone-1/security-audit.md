# Milestone 1 Security Audit

## Result

Milestone 1 passes the security review for the current scope. Authentication, organization isolation, initial RBAC, session handling, and sensitive account operations are enforced by the backend rather than trusted to the frontend.

## Verified controls

- Access tokens are signed JWTs with a server-side secret and authenticated requests re-check that the user is active.
- Passwords use bcrypt with 12 rounds. Login uses one generic failure response for missing, deleted, and invalid-password accounts.
- Refresh tokens are random, hashed at rest, stored in HTTP-only cookies, rotated on use, and revoked on password change or account deletion.
- Refresh cookies use `SameSite=Lax`, production-only `Secure`, and the narrow `/auth` path.
- Organization access is derived from the authenticated user's membership. Invalid or unauthorized organization IDs are concealed as not found.
- Endpoint RBAC restricts membership mutations and invitations to owners; owner/manager access is used only where intended.
- The last-owner invariant is protected with serializable transactions for role changes, removal, and account deletion.
- Invitations are random, hashed at rest, expiring, single-use, revocable, and require the signed-in account email to match.
- Global DTO validation strips unknown fields and rejects non-whitelisted input.
- CORS permits only the configured frontend origin with credentials.
- Helmet now applies standard HTTP security headers.
- Production defaults disable Swagger unless explicitly enabled.

## Evidence

- Unit coverage exists for authentication, refresh sessions, refresh cookies, organization access, memberships, branches, and invitations.
- Milestone 1 HTTP tests cover missing authentication, concealed cross-organization access, role denial, and DTO validation.
- Database uniqueness and foreign keys protect user emails, memberships, sessions, invitations, organizations, and branches.

## Residual risks

- Login and invitation-preview throttling is not implemented. Add edge or application rate limiting before exposing the API publicly.
- Access-token revocation is bounded by the configured short token lifetime; refresh sessions are revoked immediately.
- Production deployment must terminate HTTPS and use a strong, independently managed `JWT_SECRET` and database credentials.
- `npm audit` reports three high-severity findings in `deepmerge-ts`, reached through the Prisma CLI's `@prisma/config` dependency. The offered automatic fix downgrades Prisma across a breaking major version, so it was not applied. Track the Prisma advisory chain and upgrade when a compatible patched release is available; do not ship development tooling in the production runtime image.
