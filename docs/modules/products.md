# Products

**Status:** Implemented; rendered visual/accessibility QA explicitly waived

## Responsibilities

Maintain organization-owned product identities with one merchant per product.
Expose read-only branch placements with independently tracked prices and stock.
Stock mutation services are documented in [Branch Inventory](branch-inventory.md).
Owners manage product identities through the organization workspace. Managers and
linked merchants have scoped read-only product views. Branch stock management is
provided by the scoped inventory workspace.

## API and authorization

```text
POST  /organizations/:organizationId/products
GET   /organizations/:organizationId/products?q=&merchantId=&status=
GET   /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId
PATCH /organizations/:organizationId/products/:productId/status
GET   /organizations/:organizationId/products/:productId/inventory
```

Every route requires authentication and organization membership. Only owners
create/edit/change status. Managers read only products placed in assigned branches;
linked merchants read their own merchant's products. Cashiers cannot use these routes.
Queries include the trusted organization ID. Missing, inaccessible, and foreign
products or related merchants return the same not-found behavior. UUID v4
identifiers and DTO whitelisting enforce the request boundary.

Cashiers have a separate minimal [branch POS catalog](pos.md) in assigned branches;
it does not grant access to these product-management routes.

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

## Optional opening stock API

Product creation optionally accepts `initialInventory: { branchId, sellingPrice,
quantity, lowStockThreshold? }` together with a UUID v4 `requestId`. Both must be supplied together;
null, malformed and unknown nested fields are rejected. `branchId` is an explicitly
selected same-organization branch. Price is positive PHP decimal text with up to
ten integer and two fractional digits; quantity is a whole number `1..2147483647`.
The threshold is an optional integer `0..2147483647` and defaults to `5`.
Requests omitting both preserve product-only creation without any stock record.
The owner new-product form exposes this option, off by default. Product editing
does not offer opening stock.
The opening-stock form starts the threshold at `5`, validates every edit after a
short debounce, and explains that `0` disables only the low-stock warning.

For a new opening-stock command, current owner membership, non-deleted actor,
tenant branch and active tenant merchant are checked inside a serializable
PostgreSQL transaction. Product creation, one branch placement with the opening
balance and one RECEIPT movement commit together or roll back together. The server
sets the reason to `Initial stock on product creation` and attributes the receipt
to the authenticated owner. Other branches are untouched. The Inventory placement
endpoint separately requires an explicit nonnegative opening quantity and records
an attributed RECEIPT for positive stock in that branch; product creation's
opening-stock workflow remains separate.
The Inventory placement endpoint accepts the same optional threshold independently
of opening stock. Omitting or explicitly supplying `5` uses the default threshold;
an explicit `0` is preserved.

Product placement reads expose both the saved branch threshold and the stock
status derived by the inventory module. The product profile displays this branch-
specific status and threshold; neither is a product-wide default.

Product stores nullable private `creationRequestId`, `creationActorId` and canonical
`creationCommand` metadata, protected by a complete-group check, actor foreign key
and unique `(organizationId, creationRequestId)` index. All product responses use
the existing public projection and never expose this metadata. Receipt request
IDs are generated independently in the existing movement namespace.

The same tenant, actor, request ID and normalized command returns the original
product ID without writing again, including products without SKU/barcode. Replay
rechecks current owner and branch access, compares stored original creation input
rather than mutable product/price/stock state, and returns the product's current
public identity. Later merchant lifecycle changes do not invalidate an already
committed command. Different actor/content reuse returns `409` with
`PRODUCT_CREATE_REQUEST_CONFLICT` and no original-command disclosure. Concurrent
unique-request recovery is read-only; a serialization rollback returns `409`
`PRODUCT_CREATE_RETRY`, requiring an explicit same-command retry. There are no
automatic mutation retries or new generic idempotency entities.

Unit/DTO/HTTP and disposable PostgreSQL coverage validates bounds, private response
keys, owner/tenant/branch/actor isolation, legacy creation, later-edit replay,
conflicting and concurrent retries, constraints and actual insertion rollback at
each write. No application database is migrated, reset or seeded for verification.

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
Expanded frontend API/component workflow coverage passes alongside regressions
(236 frontend tests total), typecheck, lint, formatting, and production build.
Coverage includes filters, creation/editing, input normalization, role denial,
confirmed/cancelled lifecycle actions, independent placements, request-state
feedback, obsolete responses, and modal state/focus/dismissal contracts.
The user explicitly waived rendered visual/accessibility QA on September 12,
2026 after declining browser access. Rendered behavior is not certified by the
automated tests. The unperformed checklist is retained in the
[completed plan](../plans/archive/products-and-branch-inventory-2026-09-12.md).

## Workspace UI

The new-product dialog includes optional Add initial stock with an explicit branch
dropdown, PHP price and whole-unit quantity. Branches are read only after enabling
the section, using the existing authorized owner branch API. No branch is selected
automatically, even when only one exists. Loading, empty and failed branch reads
block enabled opening-stock creation; read-only Retry branches never writes a
product. Disabling the section removes its controls/errors and omits both opening
inventory and request ID from the legacy product-only command. Obsolete branch
responses are ignored.

Changed fields validate after 300 ms, on blur immediately and finally on submit;
invalid submit focuses the first invalid control. Price stays decimal text and
quantity becomes a bounded numeric integer for the API. One create request carries
the entire product/opening-stock command, never separate placement/receipt writes.
Pending saves disable all fields, toggle, repeat submission and dialog dismissal.
Failed opening-stock saves retain the normalized submitted input and UUID: fields,
Cancel and dismissal remain locked while an explicit Retry same creation resends
exactly that command, including after repeated failures. There are no automatic
mutation retries. Navigation links are blocked during pending/recovery and leaving
the document invokes the browser's unsaved-work protection. Recovery is in-memory
only; forced unmount/reload is not a persistent/offline draft workflow.

Directory filters remain locked and scoped reads pause while the dialog is open,
so background refreshes cannot replace its merchant choices. Role/tenant/user
changes reset the directory scope. Confirmed success closes the form and announces
creation separately from any subsequent directory-read failure; read retry only
reloads data and never resubmits creation. Existing inventory and POS reads expose
the opening balance/price only in the chosen branch without API changes.

Part 3 frontend format/lint/typecheck/build and 472 tests across 70 files pass;
127 disposable PostgreSQL tests include inventory/POS read integration. Rendered
Inventory sidebar/dropdown and new-product dialog responsive, keyboard and zoom
QA was explicitly waived for this milestone on September 14, 2026. Automated
dialog tests do not certify browser-rendered behavior.

Frontend controls now match backend access: only owners create/edit/change status;
managers and merchants read available products and filtered branch placements.
Empty access explains asking an owner to configure links or placements. Screen
state resets on role/organization/product changes and obsolete reads are ignored;
failed refreshes clear prior product/merchant/placement data.
Managers' placement lists contain assigned branches only; merchants see own
products' placements across all selling branches. Placement candidate checks
prevent managers discovering or placing unrepresented catalog products; an owner
must place them first. Lifecycle and quantity do not affect read visibility.

```text
/app/organizations/:organizationId/products
/app/organizations/:organizationId/products/:productId
```

- Products navigation and direct screens are available to owners/managers/merchants.
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
  Placement links open the matching branch-scoped inventory detail for price,
  receiving, corrections, and immutable history. See [Branch Inventory](branch-inventory.md).
- API response schemas reject malformed identities, status, dates, quantity bounds,
  and non-decimal-string prices before rendering.
