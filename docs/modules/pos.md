# Branch POS Catalog

**Status:** Catalog API implemented; cart and checkout are not yet implemented.

## API and authorization

```text
GET /organizations/:organizationId/branches/:branchId/pos/products?q=
GET /organizations/:organizationId/branches/:branchId/pos/products/code?code=
```

Both reads require an authenticated current organization membership. Owners read
all tenant branches; managers and cashiers require a current branch assignment.
Merchants are denied, including explicitly assigned merchants. The service checks
accessible branch existence and scopes inventory queries to the organization and
current assignment. Missing, inaccessible and foreign branches use the same 404.
Unknown query fields and invalid UUID v4 identifiers are rejected.

This dedicated cashier contract does not widen existing product, merchant,
inventory/history, member-directory or stock-mutation permissions.

## Catalog rules and response

Only placed ACTIVE products of ACTIVE merchants are returned. Zero-stock rows
remain visible with `eligible: false`; positive stock sets `eligible: true`.
Eligibility and prices are read-time observations, not checkout authorization.
Each row contains only branchInventoryId, productId, name, SKU, barcode,
merchantName, sellingPrice as an exact two-decimal PHP string, quantity and eligible.
No contacts, addresses, actor IDs, movement history or organization-wide catalog
are included. Reads never change stock or prices.

Search trims optional text (maximum 254 characters), matches product name/SKU
case-insensitively and barcode case-sensitively, and orders by product name then
placement ID. Results are bounded to the first 100 matches; clients can narrow
search for larger catalogs. No total-count or paginated directory is introduced.

Exact code is required, trimmed, 1–64 ASCII letters/numbers/hyphens. SKU comparison
uses uppercase; barcode comparison retains case and leading zeroes. All distinct
matching placements are returned, not a silently chosen first match. Independent
tenant SKU/barcode uniqueness bounds exact matches to two. A product matching
both fields appears once; an unknown/unavailable code returns an empty array.

## Verification

Unit tests validate bounded queries, explicit projection and branch scope. HTTP
tests cover all roles, authentication, organization/branch denial, normalization,
unknown fields and malformed queries. Real disposable PostgreSQL tests verify
assignment access/revocation, branch/tenant isolation, SKU/barcode ambiguity,
case/leading-zero preservation, matching-both deduplication, lifecycle exclusion,
zero-stock eligibility and exact price strings. No database schema or frontend
screen changes are required for this delivery.
