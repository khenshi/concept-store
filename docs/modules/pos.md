# Branch POS

**Status:** Catalog, branch cart, payment confirmation, completion and internal receipt printing implemented.

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

Organization sidebar and mobile navigation expose POS to owners, managers and
cashiers, with branch checkout routes marking POS rather than Branches active.
`/app/organizations/:organizationId/pos` requires an explicit branch selection,
even when only one branch is available. The branch-title dropdown reuses authorized
branch reads: owners see tenant branches and managers/cashiers only assigned ones.
Loading, failed-read/retry and empty/unassigned states are provided. Missing current
branch access clears the cart and catalog. Merchants retain their separate Sales
entry and direct POS access does not request branches or catalog data.

The branch detail screen also links owners, managers and cashiers to
`/app/organizations/:organizationId/branches/:branchId/pos`. Merchants have no POS
entry point or catalog access. The workspace uses the dedicated minimal catalog,
not product, merchant or inventory management APIs.

Normal POS back buttons and the standalone history shortcut are removed. Cart and
Sales History are route-backed navigation tabs under one persistent POS layout,
header and branch dropdown. History uses `.../pos/sales`; saved receipt detail uses
`.../pos/sales/:saleId` with History active. Old staff sales list/detail links redirect
into this workspace, while merchant own-sales routes remain unchanged.

Branch changes confirm
discarding nonempty carts, invalidate obsolete code lookups and clear payment
drafts on scope unmount. Cancelled changes retain the current branch and cart.
Pending/unknown checkout prevents branch switching, including from the organization
POS entry, which instead offers the existing unresolved-checkout recovery action.

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

The cart is memory-only and keyed to user, organization, branch and role. Same-branch
Cart/History/receipt navigation preserves the cart and cash/manual payment draft
without reserving stock, recording payment or automatically completing checkout.
History filters and pagination remain mounted across these pages, and reads pause
while their page is inactive. Returning to Cart refreshes branch access and catalog;
failed return catalog reads preserve the draft but block payment review until a
successful read retry. Stored cart prices remain estimates requiring authoritative
checkout validation and existing explicit price-conflict review.

Access
denial clears cart and catalog data; late responses from an old scope are ignored.
Outgoing links and organization-menu navigation ask before discarding a nonempty
cart, except internal same-branch POS page links, and full-page unload uses the
browser's unsaved-work warning. Leaving the POS layout clears editable drafts;
browser history navigation outside it does not have a custom prompt.
Clear-cart and ambiguous-code interactions use the shared native modal dialog.
Building/editing a cart performs no sale/payment writes or stock deductions.
Confirmed checkout uses the [sales API](sales.md), which remains authoritative
for price, stock, payment values and authorization.

## Payment confirmation and recovery

Review payment opens a native dialog showing the cart and estimated total. Cash
tender validates 300 ms after each input, immediately on blur and on submission;
it must cover the total. GCash/card are explicitly manual and provider-unverified,
requiring a trimmed 2–100 character reference. Staff must explicitly confirm that
payment was received. Changing method clears its fields and received confirmation.
Estimated change uses integer cents; completion displays backend-persisted change.

Pending checkout blocks cart/payment edits, repeat activation, Escape/backdrop
dismissal and outgoing link/menu navigation. A known rejected unchanged command
keeps its request ID; changed content receives a new ID only after known rejection.
Price conflicts update the identified cart price and require another review and
received confirmation. Stock/lifecycle conflicts mark the affected line invalid;
staff must correct or remove it. Refresh never automatically submits checkout.

Network/server errors, malformed/mismatched successful responses and request-ID
conflicts are treated as uncertain outcomes. The frozen command remains locked for
same-ID retry, without collecting payment again. A subsequent rejection does not
unlock a previously uncertain command. Focused in-memory attempt state is keyed
to organization and authenticated user and survives route unmounts: another branch
in that organization blocks new checkout and links back to the original branch.
Returning recovers the frozen command without auto-submitting. A response that
completes while unmounted is recovered as a completed receipt without another POST.
This is not persistent/offline storage: page reload/tab closure loses memory and
uses the browser unload warning; staff must verify recorded sales before recreating
an uncertain transaction after leaving the page. Role/branch checks still apply to
every retry, and another user's session never receives this in-memory attempt.

Pending/unknown checkout also blocks History tab switching. If browser history or a
deep-link transition targets History with a frozen same-branch command, the workspace
keeps Cart/recovery visible and does not request sales or auto-submit checkout.
Only the active receipt mounts the print portal, so a hidden completion receipt
cannot print alongside a saved receipt opened within the History workspace.

Completion clears the cart and shows validated persisted receipt snapshots. Failed
catalog refresh retries only the read and preserves the receipt. Printing uses a
receipt-only print surface without shell/cart controls, and shows print-dialog or
failure feedback without claiming the printer succeeded. Print cancellation/failure
can retry printing only. Receipts are internal transaction records, not fiscal/tax
invoices. POS links to branch history and the saved receipt detail; merchant own-sale
screens remain separate and do not expose full receipt/print controls.

## Verification

The navigation/workspace refinement passes frontend lint, type checking, production build,
changed-file formatting and 430 tests across 67 files. Added tests cover explicit
branch selection, unassigned members, revoked current access, read retry, obsolete
responses, pending/unknown switching locks, merchant denial and cancellation versus
confirmed cart clearing, same-branch cash/manual draft retention, history
dates/pagination retention, fresh return reads/retry, old staff redirects, frozen
checkout visibility and single-receipt printing. Full formatting currently flags an unrelated existing
inventory-api.ts edit, which this change preserves. The user explicitly waived
rendered dropdown/tab/responsive/keyboard/dialog/zoom/print QA for this refinement
on September 13, 2026, separately from prior milestone waivers. It was not performed;
automated checks do not certify rendered behavior or actual printing.

Unit tests validate bounded queries, explicit projection and branch scope. HTTP
tests cover all roles, authentication, organization/branch denial, normalization,
unknown fields and malformed queries. Real disposable PostgreSQL tests verify
assignment access/revocation, branch/tenant isolation, SKU/barcode ambiguity,
case/leading-zero preservation, matching-both deduplication, lifecycle exclusion,
zero-stock eligibility and exact price strings. Frontend tests cover role gates,
scoped API contracts, Enter/in-flight behavior, ambiguity, stock and quantity
validation, exact estimates, cart clearing, access revocation and navigation guards.
Payment/receipt tests cover exact cash/manual validation, pending/unknown locking,
unchanged and edited command IDs, route recovery, isolated attempt state, explicit
price re-review, failed post-completion catalog reads and print-only retries.
Frontend formatting, type checking, lint, all 401 tests across 63 files and the
production build pass. The user
explicitly waived rendered responsive, keyboard/dialog, zoom and print QA for this
POS/sales milestone on September 13, 2026. This is a new waiver, separate from access
control. Automated dialog and print tests do not certify browser-rendered behavior.
