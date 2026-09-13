# Branch POS Checkout and Sales Plan

**Status:** Approved; Parts 1–5 committed; Part 6 verified, awaiting review before commit.
**Date:** September 13, 2026

## Goal and confirmed decisions

Complete branch-scoped checkout using existing quantity-tracked merchant products
and branch-specific PHP prices. Record completed sales and deduct stock atomically.

- Exact SKU/barcode input adds a product on Enter. Repeated codes increase quantity;
  ambiguous matches require an explicit choice, never silently choose a product.
- Cash and manual GCash/card payments, one method per sale. Cash records tender
  and change; GCash/card requires a reference, without provider verification.
- No price overrides. Changed branch prices require reviewing the new total.
- Cashiers read their own sales in assigned branches; managers read sales in
  assigned branches; owners read all tenant sales. Linked merchants read sales
  involving their own products, across selling branches, with own-item projections.
- Completed sales are immutable. Browser-print receipts are internal transaction
  records, not fiscal/tax invoices.
- Preserve the part-by-part workflow: implement one part, stop for review, commit
  only after approval, then implement the next part.

## Repository baseline and scope

The repository currently has products, independent branch inventory, immutable
receipt/adjustment movements, current-database branch authorization, and role-aware
workspace screens. It has no sales, checkout, payment, or receipt module.

Reuse authentication, organization guards, assignments, products, inventory,
decimal validation, native dialogs, and DESIGN.md. Add focused POS/sales services
inside the existing NestJS modular monolith and feature-owned Next.js screens.
PostgreSQL remains the only authoritative datastore.

Exclude refunds, voids, returns, discounts, taxes/tax-invoice logic, price overrides,
split/partial payments, credit sales, customers, payment gateways, reconciliation,
cash shifts/drawers, hardware-printer integrations, offline checkout, stock
reservations/transfers, settlements/commissions, aggregate merchant sales reports, analytics,
generic permissions, new infrastructure, and unrelated refactors.

## Approved operational defaults

- OWNER and assigned MANAGER/CASHIER may perform checkout. MERCHANT may not.
- A cart belongs to exactly one branch and stays in client memory only. Switching
  branch/organization or losing access clears the cart and payment draft; warn
  before voluntarily discarding a nonempty cart. No server draft-sale entity.
- Only ACTIVE products belonging to ACTIVE merchants may be sold. Products must
  already have inventory in the selected branch. Out-of-stock rows are readable
  in POS but cannot be added; inactive/unplaced products are unavailable.
- One line per placement; quantity is a positive whole number. Cap checkout at
  100 distinct lines and existing integer quantity bounds. Duplicate line IDs and
  malformed/unknown fields are rejected rather than silently merged by the API.
- PHP only; no discounts or tax breakdown. Total is the exact sum of unit price
  times quantity. Tender, change, unit prices, line totals, and sale total remain
  decimal strings in contracts and precise decimal/numeric values in PostgreSQL.
- Manual payment references are trimmed, 2–100 characters, and not globally
  unique. They record what staff entered, not proof of payment. The UI requires
  explicit confirmation that payment was received before completion.
- Cash tender must cover the total; change is backend-derived. Noncash commands
  reject cash tender, and cash commands reject noncash references.
- Sales lists are branch-scoped, newest first, with bounded pagination (default
  50, maximum 100). Date ranges use UTC timestamps; no summary/report totals.
- Receipt identifier is a persisted, organization-unique server-generated code;
  not a gapless fiscal sequence. Receipt prints organization/branch identity,
  identifier/time, cashier display name, item snapshots, totals, method, and
  tender/change or reference. No merchant/member contacts or addresses are needed.

The user approved this revised plan, including merchant own-sale access and these
defaults, on September 13, 2026. Material changes require revising the plan.

## Authorization and catalog reads

Every POS/sale route requires authentication and current organization membership.
Owners have implicit branch access; manager/cashier assignments are checked from
the database, including sale details, receipt reads, and idempotent replay.
Foreign, absent, and inaccessible branch/sale IDs share 404 behavior. Role-denied
operations use 403. Cashier sale queries additionally require createdById equal
to the authenticated user, even when another sale is in the same assigned branch.

MERCHANT sale reads require a current merchant-profile link and at least one
SaleItem with that merchantId in the trusted organization and requested branch.
Historical item ownership determines visibility, not current product lifecycle or
stock quantity. Selling-branch access is automatic for these own-sale reads, even
without explicit assignments or current placements; explicit branch assignments
never expose other merchants' sales. Unlinked merchants receive empty lists.
Relinking changes subsequent sale visibility without changing historical ownership.

Merchant lists/detail return sale ID, receipt code, completion time, branch
ID/name/code, their own item snapshots/quantities/unit prices/line totals, and an
explicitly labeled own-items subtotal. Mixed-merchant sales never expose other
items, whole-sale totals or item counts, cashier/member identity, payment method,
tender/change, payment references, checkout request IDs, or canonical retry data.
Pagination counts only matching sales. Foreign/other-merchant sale guesses use 404.
Merchants cannot complete/replay checkout or obtain the full receipt, even for a
sale containing only their products. Their detail is a read-only sales view,
not a printable full customer receipt.

Add a dedicated minimal branch POS catalog read for CASHIER rather than widening
existing product/merchant/inventory permissions. Return placement ID, product
identity/SKU/barcode, merchant name, current branch price, quantity, and eligibility.
Never expose merchant contacts, organization-wide catalogs, movement actors,
member directories, or inventory mutations to cashiers.

Exact lookup trims outer whitespace, normalizes SKU to uppercase, and compares
barcode case-sensitively with leading zeroes retained. A code may match one
product's SKU and another's barcode, so return distinct matching placements for
explicit selection. A product matching both fields appears once. Search and code
queries resolve only in the selected authorized branch. Code input Enter handling
prevents accidental checkout submission and guards duplicate in-flight lookups.

## Persistence and history

Add Sale and SaleItem, with deliberate restrictive deletion and tenant-safe
composite foreign keys to branch, placement, product, merchant, and sale.

- Sale: ID, organization/branch IDs, unique receipt code, authenticated actor ID,
  UUID checkout request ID, payment method, cash tender/change or noncash reference,
  precise total, completion timestamp, and required receipt identity snapshots.
  Only completed records exist; no pending/void/refund statuses or payment entity.
- SaleItem: tenant/branch/sale/placement/product/merchant IDs, quantity, product
  name/SKU/barcode and merchant-name snapshots, unit price, and line total.
  Unique sale/placement prevents duplicate lines. Preserve amounts and names
  despite later catalog, branch, organization, or account changes.
- Add SALE inventory movement with a negative delta and a nullable, uniquely
  linked sale-item reference. Checks require that only SALE carries this link,
  and SALE delta is negative. Existing RECEIPT/ADJUSTMENT commands stay unchanged.
  Each sold line creates exactly one attributed movement in the checkout transaction.
- Keep existing movement request-ID uniqueness; checkout movement IDs are generated
  by the server, never supplied as individual stock commands by the client.
- Index actual patterns: branch completion order, cashier's branch sales, checkout
  replay lookup, merchant-owned sale items, and sale items. Add positivity/payment/link constraints where
  practical. Monetary capacity must cover the allowed whole checkout, not just
  one existing Decimal(12,2) unit price.

Existing owner/manager inventory history includes SALE deductions. Merchant own
history continues to expose operation/delta/balance/reason/time only, including
SALE, without actor IDs, sale IDs/items, receipt codes, payment references, or a
new sales link in movement history. Own sales are exposed separately through the
projected sales routes. Use a neutral checkout reason and explicit response projections.
Cashiers still cannot use inventory history or stock-write endpoints.

## Checkout transaction and safe retries

The command contains requestId, distinct placement IDs/quantities, expected unit
prices from the reviewed cart, payment method, and method-dependent fields.
Do not accept client totals, actor IDs, merchant ownership, or stock balances.
Expected prices are comparison values only; the backend derives actual prices.

In one transaction, resolve tenant/branch placements, verify lifecycle/current
prices, derive precise totals/payment values, apply bounded stock decrements,
persist Sale/SaleItems and SALE movements. Lock/order inventory writes consistently
and use appropriate transaction isolation so concurrent price/status changes and
checkout/stock commands cannot produce overselling or inconsistent recorded prices.
Serialization/deadlock conflicts return retryable 409; never partially commit.

- Insufficient stock or changed prices returns a descriptive conflict with only
  authorized line information. No stock deduction/sale is committed.
- Price conflict refreshes the cart and payment total for review; never silently
  resubmit or accept a higher price. Refresh alone does not authorize completion.
- Unique (organizationId, requestId) provides whole-sale idempotency. Identical
  normalized command replay returns the original completed sale without further
  deductions; changed content returns 409. Replay checks precede new-stock/price
  validation, but never bypass current actor/branch authorization. Only the
  original checkout actor may replay that command.
- Persist enough canonical command data to compare retries, including reviewed
  prices and tender/reference. This is focused sale retry data, not generic infra.
- Retain the same request ID for an unchanged failed/unknown checkout. Editing a
  draft generates a new ID only when the previous attempt is known not to have
  committed. An unknown outcome locks the command for safe identical retry;
  do not let staff create a second sale from it accidentally.
- Successful completion clears the cart and shows the persisted sale/receipt.
  Failed catalog/history refresh or failed printing retries reads/printing only,
  never repeats completion under a new request ID.

## API and frontend contracts

Proposed branch-scoped routes:

~~~text
GET  /organizations/:organizationId/branches/:branchId/pos/products?q=
GET  /organizations/:organizationId/branches/:branchId/pos/products/code?code=
POST /organizations/:organizationId/branches/:branchId/sales
GET  /organizations/:organizationId/branches/:branchId/sales?from=&until=&page=&limit=
GET  /organizations/:organizationId/branches/:branchId/sales/:saleId
~~~

Sale detail supplies the authorized persisted receipt; no separate mutable receipt
endpoint. MERCHANT receives the reduced own-item detail instead, never full receipt
data. Also add GET /organizations/:organizationId/sales/branches for MERCHANT,
returning only branch ID/name/code with matching historical own sales. This focused
lookup makes past selling branches discoverable without widening existing branch
detail permissions or revealing addresses/counts. Strict DTO whitelisting/UUID
validation and OpenAPI must match runtime
schemas and normalized responses. Controllers stay thin; transaction logic lives
in focused services, not reused public inventory receipt/adjustment calls.

Frontend routes under each branch: POS, sales list, and sale detail/print view.
Owners/managers/cashiers reach them through accessible branch details. Merchants
receive a Sales navigation entry with the filtered historical selling-branch
identity lookup, then own-sales lists/details. Accessible branch details may also
link to own sales. Merchants receive no POS, checkout, full-receipt print, or payment
controls. Preserve existing inventory controls by role.

Provide bounded search/ambiguity choices, code-input focus restoration, quantity
edit/remove actions, precise running total, and a payment confirmation dialog.
Cash tender and reference validate 300 ms after input, immediately on blur, and
finally on submit. Pending checkout disables draft edits/repeat activation and
unsafe dismissal. Clearly label GCash/card as manually recorded/unverified.
Show loading, empty/unassigned, invalid code, stock/price conflicts, revoked access,
unknown completion, retryable failure, completion, and print feedback.
Client displays are estimates until server completion; backend is authoritative.

## Verification and documentation

Cover all roles, unassigned branches, cross-tenant/branch/sale guesses, cashier
own-sale restrictions, filtered/minimal catalog data, code normalization/ambiguity,
inactive/unplaced/out-of-stock products, quantity limits, strict payment fields,
precise totals/tender/change, price re-review, immutable snapshots, and projections.
Include mixed-merchant sales, linked/unlinked/relinked members, automatic historical
selling-branch discovery, removed placements/inactive products, own-subtotal
precision, reduced responses and pagination metadata, and no cashier/payment/
other-merchant leakage. Current profile links and tenant scope remain authoritative.

Disposable PostgreSQL tests must exercise FK/check constraints, rollback after
sale/item/movement failure, multi-line all-or-nothing writes, concurrent checkouts
and inventory adjustments/receipts, exact and conflicting duplicate requests,
price/lifecycle conflicts, and ledger/balance reconciliation. Never migrate/reset
application databases for verification.

Frontend tests cover Enter/repeated codes, ambiguity selection, branch/cart clearing,
payment validation/pending behavior, stock/price errors, unchanged/unknown retry
IDs, successful-write refresh failure, role restrictions, snapshots, and printing.
Run Prisma format/validate/generate; backend format/lint/build/unit/HTTP/PostgreSQL;
frontend format/lint/typecheck/tests/build and diff checks. Rendered responsive,
keyboard/dialog, zoom, and print QA requires browser access or a new explicit
waiver; the access-control milestone's waiver does not carry over.

Document implemented POS/sales behavior in new module docs, update inventory,
frontend/branch docs, test/seed guides and documentation index as delivered.
Add representative sales only to disposable demo seed; preserve balanced ledgers.
Archive this plan after completion. Do not change module docs to describe proposed
features before implementation.

## Delivery and review checkpoints

### Part 1 delivery — September 13, 2026

Implemented Sale/SaleItem persistence, scoped SALE movement links, migration
constraints/indexes, private-link-safe existing inventory history, and three
atomic demo sale examples. No checkout/catalog/sales API or POS screen is added.
Sales module, inventory, seed, test setup and documentation index describe only
this delivered scope. Monetary capacity tests use a 40-digit decimal clone;
later checkout calculations must likewise avoid the library's default precision
when deriving maximum approved totals.

Verification: Prisma format/validate/generate; backend format/lint/build and
202 unit, 68 HTTP, 64 PostgreSQL integration tests (31 new persistence cases);
frontend format/lint/typecheck/build and 268 tests. Migration deployment and demo
seeding were checked only in a disposable PostgreSQL 17 container. No application
database was migrated/reset. Rendered POS QA remains for later frontend parts.
User approved Part 1 on September 13, 2026; committed as `ed0f128`.

### Part 2 delivery — September 13, 2026

Implemented dedicated branch POS search and exact-code reads, current branch
assignment enforcement for managers/cashiers, minimal explicit projections and
matching SKU/barcode ambiguity without silent selection. Search is bounded to
the first 100 matches in stable name/placement order; narrow search for larger
catalogs. Exact results remain complete (at most two due to existing identifier
uniqueness). Active lifecycle filtering preserves visible zero-stock rows with
an explicit ineligibility flag. Existing management permissions are unchanged.
No checkout writes, cart/payment/sales screens or schema changes are added.

Verification passes: backend format/lint/build, 205 unit tests, 81 HTTP tests
and 65 PostgreSQL integration tests. PostgreSQL uses only a disposable container
and random isolated schemas; the application database is untouched. Frontend
files are unchanged in this part. Diff whitespace checks pass.

User approved Part 2 on September 13, 2026; committed as `aeccccc`.

### Part 3 delivery — September 13, 2026

Implemented strict checkout DTO and POST branch sales, server-derived exact
pricing/payment totals, serializable atomic sale/item/stock/movement writes,
fresh in-transaction membership/assignment enforcement, original-actor canonical
replay, price/lifecycle/stock conflicts and retryable concurrency handling.
Explicit completion snapshots omit creator/request IDs and canonical commands.
No sales list/detail lookup, merchant projections, cart/payment screens, printing,
schema changes or excluded refund/payment-provider workflows are added.

Verification passes: Prisma validation, backend format/lint/build, 242 unit tests,
93 HTTP tests and 89 PostgreSQL integration tests, with the final database suite
passing twice consecutively. Coverage includes full-capacity 100-line arithmetic,
complete write-failure rollback, mixed ownership, sold-out/inactive canonical
replay, current access and original-actor enforcement, concurrent overselling,
inventory correction competition and identical/conflicting checkout-ID races.
Only disposable PostgreSQL 17 and isolated schemas were used; the application
database and unrelated root package/audit changes remain untouched. Frontend
files are unchanged. Diff whitespace checks pass.

User approved Part 3 on September 13, 2026; committed as `630d21b`.

### Part 4 delivery — September 13, 2026

Implemented scoped sales list/detail reads, private-data-free merchant own-item
projections and exact ownItemsSubtotal, and MERCHANT-only historical selling-branch
identity lookup. Fresh database membership/profile and branch checks share a
repeatable-read snapshot with list count/rows and detail projections. Staff scope
is owner-all, manager-assigned, cashier-assigned-and-own-actor; merchant access
requires an assignment or matching own historical sale items and never exposes
other sales. Unlinked/assigned branches return empty own lists; inaccessible branch
and detail guesses return 404. Added strict bounded pagination, half-open UTC range
validation, precise projection/OpenAPI contracts and expanded PostgreSQL races.
No frontend screens, printing, schema changes or excluded mutations are added.

Verification passes: Prisma validation, backend format/lint/build, 258 unit tests,
106 HTTP tests and 99 PostgreSQL integration tests, with the final database suite
passing twice consecutively. Tests cover exact merchant projection keys/subtotals,
unlinked detail denial, relinking/shared profiles, historical selling branches,
current role/assignment/actor scope, stable own-filtered pagination/UTC boundaries,
receiving/withdrawal competition, opposite multi-line carts, second-line movement
rollback and lock-controlled concurrent price/product/merchant lifecycle changes.
Only disposable PostgreSQL 17 and isolated schemas were used; the application
database and unrelated root package/audit changes remain untouched. Frontend
files are unchanged. Diff whitespace checks pass.

Stop for user review after verification; do not commit Part 4 or begin Part 5
before approval. The full plan remains active until all parts are delivered.

### Part 5 delivery — September 13, 2026

Part 4 was approved and committed as `a2a3203`. Part 5 adds the branch-scoped
memory-only POS cart, minimal catalog search, exact Enter code lookup, explicit
ambiguity selection, quantity validation, exact integer-cent estimates and
role-aware branch entry points. Navigation guards cover outgoing links and the
organization switcher; scope changes/access denial clear stale cart state.
Browser history navigation clears on unmount without a custom confirmation.
Payment submission, completion, receipts and sales-history screens remain excluded
until their respective parts. Unrelated root package/audit files are untouched.

Stop for user review before committing Part 5 or implementing Part 6. Rendered
browser QA remains pending for the POS milestone.

Verification passes: frontend formatting, type checking, lint, 307 tests across
55 files, production build and diff whitespace checks. No backend/schema changes
were required. The existing multiple-lockfile build warning remains unchanged.

### Part 6 delivery — September 13, 2026

Part 5 was approved and committed as `eaf5386`. Part 6 implements the native payment
confirmation dialog for cash/manual GCash/card, debounced payment validation and
explicit received confirmation, known-conflict cart re-review, same-ID retries,
pending/unknown command locking, successful completion and internal receipt printing.
Focused memory-only attempt recovery prevents route unmount from permitting a
replacement checkout in the same organization while its outcome remains unknown.
Lost full-page memory requires verification of recorded sales before recreation;
browser unload warnings do not provide offline persistence. Completion refresh or
printing retries never repeat checkout. Typed conflict details are projected through
the existing authenticated client without exposing private error payload fields.
The existing checkout/read APIs and schema are unchanged. Staff/merchant sales-history
screens remain excluded until Part 7. Unrelated root package/audit changes are untouched.

Stop for review before committing Part 6 or beginning Part 7. Rendered responsive,
keyboard/dialog, zoom and print QA remains pending for this milestone.

Verification passes: frontend format checks, type checking, lint, 353 tests across
60 files, production build and diff whitespace checks. Tests include manual/cash
validation, exact change, pending repeat/dismissal prevention, price/stock/lifecycle
review, normalized unchanged retry IDs, unknown/revoked retry locking, route-unmount
recovery, user/tenant attempt isolation, successful-write catalog refresh failure,
receipt validation/snapshots and print-only failure retry. No backend/schema changes
or application database writes were required. The existing multiple-lockfile build
warning remains outside this part's scope.

### Remaining part-by-part sequence

1. Sale/item/SALE movement persistence, migration, integrity tests and seed.
2. Authorized minimal branch POS catalog, search and exact-code lookup API.
3. Atomic checkout, payment validation, price review and idempotent replay API.
4. Scoped sale list/detail receipt reads, merchant own-item projections and historical
   selling-branch lookup, and expanded HTTP/PostgreSQL races.
5. Branch POS cart, code/search/ambiguity interactions and role-aware entry points.
6. Payment confirmation, conflict/retry/completion flows and internal receipt print.
7. Scoped sales history/details including merchant read-only views, full verification,
   documentation and archive.

Stop for review after every part; no automatic commits or next-part implementation.
Preserve unrelated root package and performance-audit changes.

## Definition of done

An authorized cashier can complete a reviewed branch cart once, record cash or
manual GCash/card, receive an immutable internal receipt, and inspect their own
sales. Managers/owners see only their permitted sales. Merchants see only sales
involving their linked business, projected to their own items/subtotal without
other-merchant, cashier, or payment data. Concurrent operations never
oversell or partially deduct stock; recorded prices/totals and retry semantics hold.
Existing inventory/access behavior remains intact, merchant projections stay safe,
applicable checks pass, and exclusions remain excluded.
