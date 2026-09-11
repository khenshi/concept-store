# Milestone 2 — Merchant Profiles

**Status:** Proposed for approval; implementation not started
**Date:** September 12, 2026

## Goal

Allow owners and managers to maintain organization-owned merchant business
profiles. This milestone establishes merchant identity only; it does not attach
operational or financial behavior to merchants.

## Scope

- Create merchant profiles.
- List, search, and filter merchants within an organization.
- View and edit a merchant profile.
- Change a merchant's lifecycle status without deleting its record.
- Add owner/manager merchant-management pages to the organization workspace.
- Add tenant-isolation, authorization, validation, service, API, and frontend
  tests for the delivered workflows.
- Add representative merchant records to the disposable development seed.
- Document the completed schema, API, authorization, and business rules.

## Explicit exclusions

- Merchant login or linking a merchant record to a user/membership.
- Branch participation or branch assignment.
- Products, inventory, POS, sales, reporting, and payments.
- Space profiles, occupancy, agreements, rent, commission, settlements, and
  payouts.
- Merchant deletion, bulk import/export, attachments, custom fields, and audit
  event infrastructure.

These exclusions must not produce placeholder tables, fields, routes, UI, or
abstractions.

## Data model

Add one organization-owned `Merchant` entity:

```text
Merchant
- id             UUID, primary key
- organizationId UUID, required
- name           required
- code           optional
- contactName    required
- email          optional
- phone          required
- status         ACTIVE | INACTIVE | SUSPENDED | ENDED
- createdAt
- updatedAt
```

Rules and constraints:

- `Organization` has many merchants.
- `organizationId` is derived from the authenticated organization context and
  is never accepted in a request body.
- Merchant names are not unique because separate businesses may share a name.
- A non-null code is unique within its organization, normalized to uppercase,
  and may be reused by a merchant in another organization.
- Add `@@unique([organizationId, code])`, `@@unique([id, organizationId])`,
  `@@index([organizationId, status])`, and `@@index([organizationId, name])`.
- The organization relation uses `onDelete: Restrict`.
- Status defaults to `ACTIVE`.
- There is no delete operation. `ENDED` preserves the profile for later
  historical relationships.

## Validation

- `name`: trimmed, 2–120 characters.
- `code`: optional; trimmed and uppercased; 2–32 characters; uppercase letters,
  numbers, and internal hyphens only.
- `contactName`: trimmed, 2–120 characters.
- `email`: optional; trimmed, lowercased, valid email, at most 254 characters.
- `phone`: trimmed, 7–30 characters. Preserve user-readable formatting rather
  than requiring one national format.
- `status`: one of the four defined enum values.
- Create accepts profile fields but not `status`; new merchants are active.
- Profile update rejects an empty body and cannot change status.
- Status changes use a dedicated DTO and endpoint.
- Global DTO whitelisting continues to reject unknown fields.

## API

All routes use `AuthGuard`, `OrganizationAccessGuard`, and organization roles
`OWNER` or `MANAGER`.

```text
POST  /organizations/:organizationId/merchants
GET   /organizations/:organizationId/merchants?q=&status=
GET   /organizations/:organizationId/merchants/:merchantId
PATCH /organizations/:organizationId/merchants/:merchantId
PATCH /organizations/:organizationId/merchants/:merchantId/status
```

Behavior:

- List results are ordered by merchant name and then ID for deterministic output.
- `q` is optional and searches name, code, contact name, email, and phone
  case-insensitively.
- `status` is an optional exact filter.
- This milestone returns the complete filtered list; pagination is not added
  before an actual scale requirement.
- Malformed organization or merchant IDs return `400`.
- A missing organization membership returns `404` through the existing guard.
- A missing or foreign-organization merchant returns the same `404` response.
- Cashiers and merchant-role members receive `403` and cannot list or mutate
  merchant profiles.
- A duplicate organization-scoped code returns `409`.

The backend module contains thin controllers, DTO validation and normalization,
and a service responsible for tenant-scoped queries and Prisma error mapping.
OpenAPI response DTOs are updated for the merchant contract.

## Frontend

Add the following organization-scoped routes:

```text
/app/organizations/:organizationId/merchants
/app/organizations/:organizationId/merchants/new
/app/organizations/:organizationId/merchants/:merchantId
```

Owner/manager experience:

- Add `Merchants` to organization navigation only for owners and managers.
- Directory includes debounced search, status filter, loading skeleton, empty
  state, request error, status badge, and create action.
- Creation uses a dedicated page and returns to the created merchant profile on
  success.
- Profile page displays business/contact information and supports profile edits.
- Status change is a separate, confirmed action so it cannot be submitted
  accidentally with ordinary profile edits.
- Reuse current feature boundaries and shared controls; route modules remain thin.
- Client schemas mirror server validation for usability, while the backend
  remains authoritative.

No merchant navigation is shown to cashiers or merchant-role members.

## Security and tenant isolation

- Every merchant query includes `organizationId` from authenticated context.
- Entity IDs never authorize access by themselves.
- Update operations first resolve the merchant inside the active organization.
- Unique-conflict handling must not expose records from another tenant.
- The frontend's role-based visibility is not an authorization boundary.
- No client-provided role, organization ID, or status-on-create is trusted.

## Testing

Backend unit tests cover:

- creation and normalization;
- deterministic listing, search, and status filtering;
- organization-scoped retrieval and updates;
- empty update rejection;
- status changes;
- duplicate-code conflict mapping; and
- foreign-organization IDs returning not found.

Backend end-to-end tests cover:

- owner and manager access;
- cashier and merchant-role denial;
- malformed IDs;
- cross-tenant list, read, update, and status isolation;
- DTO rejection of unknown or invalid values; and
- the complete create-to-status-change workflow.

Frontend tests cover:

- API request/response validation;
- merchant form validation and normalization;
- directory loading, empty, error, search, and filter states;
- role-aware navigation;
- create and edit success/failure behavior; and
- confirmed status changes.

## Implementation sequence

1. Add the Prisma model, enum, relation, migration, generated client, and seed.
2. Add backend merchant DTOs, types, service, controller, module, and OpenAPI DTO.
3. Add backend unit and end-to-end coverage, especially cross-tenant tests.
4. Add frontend types, schemas, API client, routes, navigation, directory,
   creation, profile editing, and status controls.
5. Add frontend coverage.
6. Run Prisma validation/generation, backend format/lint/build/tests/e2e, and
   frontend format/lint/typecheck/build/tests.
7. Replace this proposed plan with completed milestone documentation only after
   implementation and verification.

## Definition of done

- Owners and managers can complete every scoped merchant-profile workflow.
- Cashiers, merchant-role members, unauthenticated users, and other tenants
  cannot access merchant records.
- Validation and database constraints enforce the documented invariants.
- Status changes preserve merchant records; no deletion path exists.
- All applicable validation commands pass.
- No excluded capability or placeholder for it is introduced.

## Approval boundary

This document is a proposed implementation plan. Do not implement it until the
user explicitly approves the plan and instructs the agent to proceed.
