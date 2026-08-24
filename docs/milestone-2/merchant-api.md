# Milestone 2: Merchant API

## Scope

This part adds organization-scoped merchant profile and lifecycle operations to the backend. It includes DTO validation, tenant filtering, initial authorization, Swagger documentation, service tests, and API documentation.

Merchant user-account linking, merchant self-service, spaces, agreements, products, inventory, sales, settlements, and frontend screens are excluded.

## Endpoints

All routes require a valid JWT access token and organization membership.

| Method  | Route                                                           | Purpose                        |
| ------- | --------------------------------------------------------------- | ------------------------------ |
| `POST`  | `/organizations/:organizationId/merchants`                      | Create a merchant              |
| `GET`   | `/organizations/:organizationId/merchants`                      | List and filter merchants      |
| `GET`   | `/organizations/:organizationId/merchants/:merchantId`          | Get a merchant                 |
| `PATCH` | `/organizations/:organizationId/merchants/:merchantId`          | Update merchant profile fields |
| `PATCH` | `/organizations/:organizationId/merchants/:merchantId/status`   | Change lifecycle status        |
| `PUT`   | `/organizations/:organizationId/merchants/:merchantId/branches` | Replace branch assignments     |

Hard deletion is not exposed. Setting a merchant to `ENDED` preserves the record for future operational and financial relationships.

## Authorization

Owners and managers can use all merchant-management endpoints. Cashiers and merchant-role organization members cannot access the merchant directory in this part.

The merchant-role restriction is deliberate: a `MERCHANT` organization membership is not yet linked to a specific merchant business record, so self-access cannot be safely derived.

The backend derives the trusted organization context from the authenticated user's stored membership. Every merchant read and write includes both `organizationId` and `merchantId`. A merchant outside the organization returns not found even if its valid ID is supplied.

## Create and update validation

Creation requires:

- name: 2–120 characters
- contact name: 2–120 characters
- valid email: at most 254 characters
- telephone number: 7–25 characters using digits and common telephone separators
- at least one unique branch UUID belonging to the organization

The optional merchant code:

- is trimmed and uppercased
- is 2–32 characters
- accepts uppercase letters, numbers, and internal hyphens
- must be unique within the organization

Profile updates are partial but cannot be empty. Required profile/contact fields cannot be cleared. The optional code may be cleared with `null` or an empty string.

Branch assignments are managed separately from profile fields. Merchant responses include current branch summaries.

Email addresses are trimmed and lowercased. Names and telephone numbers are trimmed without changing their meaningful formatting.

## Listing and filtering

The list endpoint accepts:

- `status` — an exact `MerchantStatus` value
- `search` — a case-insensitive match across merchant name, code, contact name, email, and phone

Results are tenant-scoped and ordered by merchant name, then ID for deterministic output. Pagination is intentionally deferred until actual directory size and client requirements justify an API contract.

## Status behavior

Status changes use a dedicated endpoint so lifecycle actions remain distinct from profile edits. This initial part permits transitions among all defined statuses and does not create transition history.

More restrictive transition rules or status audit history should be introduced only when the business workflow requires them.

## Swagger

The merchant routes, request schemas, query filters, response model, authorization requirements, and common errors are included in the existing Swagger UI at `/docs` when enabled.

## Validation

Run from `backend/`:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm run prisma:validate
npm run format:check
```
