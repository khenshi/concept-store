# Products

**Status:** Backend API implemented and verified; frontend pending

## Responsibilities

Maintain organization-owned product identities with one merchant per product.
Expose read-only branch placements with independently tracked prices and stock.
Stock mutation services are documented in [Branch Inventory](branch-inventory.md).
Frontend product management is not yet implemented.

## API and authorization

```text
POST  /organizations/:organizationId/products
GET   /organizations/:organizationId/products?q=&merchantId=&status=
GET   /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId/status
GET   /organizations/:organizationId/products/:productId/inventory
```

Every route requires authentication, organization membership, and `OWNER` or
`MANAGER`. Queries include the trusted organization ID. Missing and foreign
products or related merchants return the same not-found behavior. UUID v4
identifiers and DTO whitelisting enforce the request boundary.

## Data and rules

- Product contains name, fixed merchant ownership, optional SKU/barcode,
  `ACTIVE`/`INACTIVE` status, and timestamps. It has no global price or quantity.
- Creation requires an active merchant in the same organization and defaults to
  active status. Merchant ownership and create status cannot be supplied through
  profile updates. Status changes use a separate endpoint.
- Name is trimmed, 2–120 characters, and not unique.
- SKU is trimmed/uppercased, 2–32 characters, with letters/numbers/internal hyphens.
- Barcode is trimmed, 1–64 ASCII letters/numbers/hyphens; case and leading zeroes
  are retained. SKU/barcode are independently unique per organization; updates
  may clear either with null or blank text.
- Empty profile updates are rejected. Duplicate SKU/barcode conflicts return `409`.
- Inactive products and products of inactive merchants remain readable/editable;
  lifecycle changes do not alter stock or price records.
- Merchant foreign keys include organization scope. Deletion is restrictive;
  there is no product deletion endpoint.

## Listing and placements

Product directory search matches name/SKU case-insensitively and barcode
case-sensitively. Merchant and product status filters are optional. Results order
by name then ID and return the complete filtered list without pagination.

Placement listing resolves the product in the active tenant, then returns scoped
inventory records with branch ID/name/code, quantity, and PHP selling price as an
exact two-decimal string. Placements order by branch name then inventory ID.
This endpoint is read-only and does not change any branch stock.

## Delivery state

Backend formatting/lint/build and unit/HTTP/PostgreSQL checks pass. Dedicated
coverage validates normalization, immutable ownership, lifecycle, scoped access,
identifier conflicts, independent branch placements, and precision. PostgreSQL
tests apply repository migrations inside random test schemas to verify database
relationships and workflows. See [backend test setup](../../backend/test/README.md).
Frontend remains Part 5 of the active plan.
