# Products

**Status:** Backend and product frontend implemented; expanded frontend QA pending

## Responsibilities

Maintain organization-owned product identities with one merchant per product.
Expose read-only branch placements with independently tracked prices and stock.
Stock mutation services are documented in [Branch Inventory](branch-inventory.md).
Owners and managers can manage product identities through the organization
workspace. Branch stock mutation UI is not yet implemented.

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
Focused frontend schema, live-validation, profile-update, pending, empty-merchant,
and navigation tests pass alongside existing frontend regressions. Expanded
workflow tests and visual/accessibility QA remain Part 7 of the active plan;
rendered behavior is not yet certified and the prior frontend-refactor QA waiver
does not apply.

## Workspace UI

```text
/app/organizations/:organizationId/products
/app/organizations/:organizationId/products/:productId
```

- Products navigation and direct screens are available only to owners/managers.
  Disallowed roles do not request product data; backend guards remain authoritative.
- Directory supports debounced name/SKU/barcode search and merchant/status filters,
  divided responsive rows, loading, retryable errors, and contextual empty states.
  Obsolete read responses are ignored when filters or routes change.
- Creation uses the shared native `FormDialog` with contained scrolling, initial
  heading focus, browser focus containment, Escape/backdrop dismissal protection
  during writes, and trigger focus restoration. Only active merchants are offered;
  creation is disabled if no active merchant exists.
- Forms validate changed inputs after 300 ms, on blur immediately, and again on
  submit. Invalid submissions focus the first invalid control. Backend errors
  preserve the form. Pending writes disable fields, repeat submission, and Cancel.
- Product identity editing cannot change merchant ownership or status. SKU is
  normalized to uppercase; barcode case/leading zeroes remain unchanged. Blank
  optional identifiers are sent as null to clear them.
- Lifecycle changes use a separate confirmed action and explain that branch stock,
  prices, and history are preserved. Existing inactive products remain editable.
- Details show branch identity, whole-unit quantity, and exact two-decimal PHP
  price strings, without converting monetary values through floating point.
  Placement links currently open branch details; inventory detail links and stock
  management are delivered separately in Part 6.
- API response schemas reject malformed identities, status, dates, quantity bounds,
  and non-decimal-string prices before rendering.
