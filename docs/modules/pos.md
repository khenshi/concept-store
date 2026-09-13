# Branch POS

**Status:** Catalog API and branch cart implemented. Payment screens are not yet implemented.

The separate [sales checkout API](sales.md) completes reviewed branch commands;
catalog eligibility remains a read-time observation only.

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

## Branch cart workspace

The branch detail screen links owners, managers and cashiers to
`/app/organizations/:organizationId/branches/:branchId/pos`. Merchants have no POS
entry point or catalog access. The workspace uses the dedicated minimal catalog,
not product, merchant or inventory management APIs.

Enter submits an exact SKU/barcode lookup, preserving barcode case and leading
zeroes. Repeated products increment one cart line. In-flight requests and input
composition cannot trigger duplicate additions; ambiguous matches require an
explicit product choice. Unknown and zero-stock products cannot be added.
Search is debounced by 300 ms and bounded to 100 matches.

Quantity feedback runs on input with 300 ms debouncing and immediately on blur.
Positive whole quantities must fit the observed stock and supported integer range.
Invalid drafts block additions and retain the last valid estimate. Monetary
estimates use integer cents, never floating-point arithmetic. The cart allows at
most 100 distinct placements and refuses silently replacing an existing price.

The cart is memory-only and keyed to user, organization, branch and role. Access
denial clears cart and catalog data; late responses from an old scope are ignored.
Outgoing links and organization-menu navigation ask before discarding a nonempty
cart, and full-page unload uses the browser's unsaved-work warning. Route unmount
also clears the cart; browser history navigation does not have a custom prompt.
Clear-cart and ambiguous-code interactions use the shared native modal dialog.
This part performs no sale/payment writes or stock deductions; backend checkout
remains authoritative for price, stock and authorization.

## Verification

Unit tests validate bounded queries, explicit projection and branch scope. HTTP
tests cover all roles, authentication, organization/branch denial, normalization,
unknown fields and malformed queries. Real disposable PostgreSQL tests verify
assignment access/revocation, branch/tenant isolation, SKU/barcode ambiguity,
case/leading-zero preservation, matching-both deduplication, lifecycle exclusion,
zero-stock eligibility and exact price strings. Frontend tests cover role gates,
scoped API contracts, Enter/in-flight behavior, ambiguity, stock and quantity
validation, exact estimates, cart clearing, access revocation and navigation guards.
Rendered browser QA for this POS milestone remains pending, not covered by the
previous access-control milestone waiver.
