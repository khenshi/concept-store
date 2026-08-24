# Branch API and Authorization

## Scope

This Milestone 1 part adds organization-scoped branch creation, listing, retrieval, and updates. It uses the existing authentication and organization-access guards.

Branch deletion, staff-to-branch assignments, inventory, POS devices, sales, store hours, maps, geocoding, and frontend branch screens are excluded.

## Role matrix

| Operation | Owner | Manager | Cashier | Merchant |
| --- | --- | --- | --- | --- |
| List and retrieve branches | Allowed | Allowed | Allowed | Allowed |
| Create and update branches | Allowed | Allowed | Denied | Denied |

All routes first require authentication and current organization membership. A valid branch ID from another organization is returned as `404` rather than exposing cross-tenant data.

## Endpoints

All routes are nested under `/organizations/:organizationId/branches`.

### `POST /`

Creates a branch. Required fields are `name`, `addressLine1`, `city`, `province`, and a two-character ISO country code. `code`, `addressLine2`, and `postalCode` are optional.

```json
{
  "name": "Makati Main",
  "code": "MKT-01",
  "addressLine1": "123 Retail Street",
  "addressLine2": "Ground Floor",
  "city": "Makati",
  "province": "Metro Manila",
  "postalCode": "1200",
  "countryCode": "PH"
}
```

### `GET /`

Lists only branches belonging to the organization established by the access guard. Results are ordered by name and then ID.

### `GET /:branchId`

Returns one branch only when both its ID and organization ID match.

### `PATCH /:branchId`

Updates one or more branch fields. An empty request returns `400`. Organization ownership cannot be changed through this endpoint.

## Validation and normalization

- Strings are trimmed.
- Empty optional strings are treated as omitted.
- During updates, `null` or an empty string clears nullable `code`, `addressLine2`, and `postalCode` fields; required fields cannot be cleared.
- Branch codes are uppercased and accept 2–32 alphanumeric characters with internal hyphens.
- Country codes are uppercased and validated as ISO 3166-1 alpha-2.
- Names and scoped non-null codes remain unique within an organization; conflicts return `409`.
- Unknown and cross-organization branch IDs return `404`.

## Security

- The controller uses the organization ID established by the membership guard, never a body-supplied tenant ID.
- Every branch lookup and mutation includes `organizationId`.
- Role checks read current membership from PostgreSQL, so role changes take effect immediately.
- Client-side route guards are not relied upon for branch authorization.

## Validation performed

Run from `backend/`:

```bash
npm run prisma:validate
npm run lint
npm test
npm run build
npm run format:check
```
