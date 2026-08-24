# Milestone 1: Frontend Completion

## Scope

The Milestone 1 frontend provides the browser interface for the completed SaaS and multi-tenant foundation:

- registration, login, session restoration, and logout
- protected application routes
- organization selection and creation
- organization workspace navigation
- organization-scoped branch listing, creation, and editing
- organization-member listing and management
- role-aware controls for owners, managers, cashiers, and merchants

The frontend uses Next.js, React, TypeScript, Tailwind CSS, and Zod. It follows the product direction in `PRODUCT.md`, the visual system in `DESIGN.md`, and the project brand guide.

## Organization member management

Route: `/app/organizations/:organizationId/members`

Owners can:

- list organization members
- add an already-registered account by email
- assign or change organization roles
- remove a member after explicit confirmation

Managers can view the member list but cannot mutate it. Cashiers and merchants do not receive member navigation and see a limited-access explanation if they directly open the route.

The frontend role checks improve usability only. The backend remains authoritative for membership, role, and tenant access.

## Validation and operational states

- Member emails are trimmed, lowercased, and validated with Zod.
- Role inputs are limited to the four Milestone 1 organization roles.
- API failures remain visible and do not silently remove current data.
- Loading, empty, success, error, and pending states are explicit.
- Successful member mutations are announced with status semantics.
- Removal requires confirmation because it revokes organization access.
- Form fields have explicit labels, connected errors, and keyboard focus recovery.

## Milestone 1 route coverage

- `/` — product entry
- `/login` and `/register` — authentication
- `/app` — organization selection and creation
- `/app/organizations/:organizationId` — organization overview
- `/app/organizations/:organizationId/branches` — branch management
- `/app/organizations/:organizationId/members` — member management

## Explicit exclusions

This milestone does not include merchant business profiles, spaces, agreements, products, inventory, POS, settlements, reporting, offline operation, subscription billing, invitations, or platform-superadmin pages.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
