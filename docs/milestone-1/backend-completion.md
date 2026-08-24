# Milestone 1: Backend Completion

## Scope

The Milestone 1 backend establishes the SaaS and multi-tenant foundation required by later business milestones. It includes:

- PostgreSQL and Prisma 7 configuration
- user registration and login
- short-lived JWT access tokens
- persistent, rotating refresh-token sessions
- logout and current-user endpoints
- organization creation and membership-based access
- organization membership management
- initial organization roles: `OWNER`, `MANAGER`, `CASHIER`, and `MERCHANT`
- organization-scoped branch management
- tenant-isolation and role guards
- required branch address data

Store settings were not introduced because no additional setting is required by the current Milestone 1 behavior.

## Security boundary

Organization routes derive the user from the verified access token and resolve organization access from the membership stored in PostgreSQL. Client-supplied organization IDs are treated only as requested resource identifiers and never as proof of access.

Users without membership receive a not-found response for an organization-scoped route. This avoids confirming whether another tenant's organization exists. Role-restricted operations return forbidden when the user belongs to the organization but lacks the required role.

Branch queries include `organizationId`, preventing a valid branch ID from being used across tenant boundaries.

## Initial role rules

| Operation                      | Owner | Manager | Cashier | Merchant |
| ------------------------------ | ----- | ------- | ------- | -------- |
| Read organization              | Yes   | Yes     | Yes     | Yes      |
| Read branches                  | Yes   | Yes     | Yes     | Yes      |
| Create or update branches      | Yes   | Yes     | No      | No       |
| List organization members      | Yes   | Yes     | No      | No       |
| Add, change, or remove members | Yes   | No      | No      | No       |

An organization must always retain at least one owner. Owner role changes and removals use serializable transactions to protect this invariant during concurrent requests.

## API areas

- `/auth` — registration, login, refresh, logout, and current user
- `/organizations` — organization creation and organizations available to the authenticated user
- `/organizations/:organizationId/members` — organization membership operations
- `/organizations/:organizationId/branches` — organization-scoped branch operations

Detailed endpoint behavior remains documented in the earlier Milestone 1 part documents.

## Validation

The backend completion checks cover:

- formatting and linting
- TypeScript compilation
- unit tests
- API-boundary e2e tests
- Prisma schema validation
- production build

The focused Milestone 1 e2e suite verifies authentication rejection, tenant concealment, branch read/write role boundaries, DTO transformation, and membership role boundaries through Nest controllers, validation pipes, and guards.

## Explicit exclusions

This backend milestone does not include merchants as business entities, spaces, products, inventory, POS, settlements, offline synchronization, subscription billing, advanced permissions, invitations, or platform-superadmin behavior.

Frontend completion is tracked separately and does not change the backend milestone boundary.
