# Milestone 2: Frontend Completion

## Scope

The Milestone 2 frontend provides organization owners and managers with the complete browser workflow for managing merchant businesses:

- merchant directory
- merchant search and lifecycle-status filtering
- merchant creation
- merchant detail and profile editing
- merchant lifecycle-status management
- role-aware organization navigation
- loading, empty, error, validation, success, confirmation, and pending states

The frontend consumes the completed Milestone 2 backend and does not introduce new merchant business rules.

## Routes

- `/app/organizations/:organizationId/merchants` — merchant directory
- `/app/organizations/:organizationId/merchants/new` — merchant creation
- `/app/organizations/:organizationId/merchants/:merchantId` — merchant profile and lifecycle status

## Authorization presentation

Owners and managers receive merchant navigation and management controls. Cashiers and merchant-role users do not receive merchant navigation. If they directly open a merchant route, the interface explains that access is limited and does not request merchant data.

These frontend checks improve usability only. The backend remains authoritative and independently enforces authentication, organization membership, tenant isolation, and role restrictions.

## Merchant directory

The directory shows:

- merchant name and optional code
- lifecycle status
- contact name
- contact email and phone
- link to the merchant profile

Users can search across the fields supported by the backend and filter by exact lifecycle status. Filters are applied explicitly rather than issuing a request after every keystroke.

Pagination remains deferred consistently with the backend API contract.

## Profile validation

Merchant creation and editing use Zod rules aligned with the backend:

- required merchant and contact names
- required valid email normalized to lowercase
- required telephone number
- optional uppercase merchant code with letters, numbers, and internal hyphens

Validation errors remain adjacent to their fields and focus moves to the first invalid control. Required fields expose native required semantics. API errors preserve the current form values.

## Lifecycle status

Status changes are kept separate from profile changes. Changing to `ENDED` requires confirmation because it represents the end of the merchant relationship. Ended merchants remain visible for historical continuity.

## Design and accessibility

The merchant experience follows `DESIGN.md` and the established operational interface:

- flat bordered panels
- explicit labels and direct English copy
- deterministic responsive task order
- visible focus states
- text-supported lifecycle badges
- announced success and error outcomes
- mobile layouts that preserve actions and record context

## Explicit exclusions

This frontend does not include merchant accounts or self-service access, invitations, multiple contacts, addresses, file uploads, spaces, agreements, products, inventory, sales, settlements, payouts, or Milestone 3 behavior.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
