# Current Implementation Plan

**Status:** Approved; Part 1 reviewed and committed as `44c01aa`; Part 2 implemented, awaiting review (uncommitted).

# Inventory Navigation and Optional Opening Stock

## Confirmed request

- Make Inventory accessible from the organization sidebar/mobile navigation.
- Give inventory a branch dropdown similar to POS and remove Back to branch.
- Offer optional initial stock when creating a NEW product in Products, not when
  placing an existing product through Add product placement.

## Smallest complete scope

### Inventory navigation

Add `/app/organizations/:organizationId/inventory` as an explicit branch-selection
entry. Never silently choose a branch. Owners see tenant branches; managers see
assigned branches; merchants see branches accessible under existing assignment/
own-placement rules and only their own inventory. Cashiers remain denied and have
no Inventory sidebar entry. Use existing authorized branch reads, not the merchant
historical-sales branch lookup. Keep inventory routes/deep links and optional
branch/product shortcuts working; inventory directory/detail routes mark Inventory
rather than Branches active.

Use a labeled branch dropdown in the inventory workspace. Changing branch goes to
that branch's inventory directory and resets filters, placement data and editable
form state. Confirm before discarding an unsaved inventory form; pending stock,
price or placement writes block branch switching. Ignore obsolete scoped reads and
clear data/controls after access denial. Include loading, read retry, unassigned/
empty and denied states. Remove normal Back to branch navigation, but retain the
detail-to-inventory action and necessary access/recovery actions.

### Optional opening stock on new-product creation

The owner-only Create product form gains an optional Add initial stock section,
off by default. Approved defaults (explicit branch selection reconfirmed):

- One explicitly selected tenant branch, its selling price in PHP and a positive
  whole opening quantity (`1..2147483647`). No automatic branch selection.
- Price follows current branch inventory precision/bounds: positive decimal text,
  up to ten integer and two fractional digits. No product-global price/quantity.
- Disabled/omitted section preserves existing product-only creation and creates
  no placement or stock movement. To start with zero stock, leave it disabled and
  use the existing placement workflow later.
- Enabled section atomically creates the product, one branch placement and one
  RECEIPT movement attributed to the authenticated owner, with the server-generated
  reason `Initial stock on product creation`. Opening balance equals the quantity;
  other branches are untouched. Failure rolls back all three writes.
- Product ownership stays fixed to one active merchant in the same tenant. Fresh
  owner membership, tenant branch and active merchant checks are authoritative.
- Product editing, initial stock on existing-product placement, multi-branch opening
  stock and manager/merchant product creation are excluded.

Extend the existing product-create API with strict optional opening-inventory input,
not a sequence of frontend create/placement/receipt calls. Keep legacy requests
and the product response compatible. Commands with opening stock require a UUID v4
request ID and same-command retry: the same organization, actor and normalized
content returns the original product without creating stock again; reuse with
different content/actor conflicts without disclosing the original command.
Persist only minimal nullable product-creation request/actor/canonical-input
metadata and tenant-scoped uniqueness needed for this workflow, reusing existing
Product, BranchInventory and InventoryMovement relationships. No generic idempotency
entity/infrastructure or global audit system. Replay must retain original creation
content despite subsequent product/price/stock edits and recheck current access.

Frontend validation runs on each input with 300 ms debouncing, immediately on blur
and finally on submit. Enabling the section requires complete valid fields; branch
loading/failure cannot silently fall back to product-only creation. Pending saves
disable repeat activation, fields, dismissal and unsafe scope changes. Failed or
uncertain opening-stock saves retain the request ID and frozen submitted input for
same-command recovery; never silently generate a new command after an unknown
outcome. Clearly distinguish creation success from failed post-save read refresh.
No persistent/offline drafts or automatic mutation retries.

## Dependencies and exclusions

Reuse organization shell/context, branch authorization APIs, Products and Branch
Inventory services/contracts, current Prisma/PostgreSQL transactions, shared
controls/native dialogs and DESIGN.md. Do not widen existing role or merchant
permissions. No transfers, purchasing, low-stock alerts, refunds, reservations,
reporting, uploads, new payment behavior or unrelated refactors/infrastructure.

Preserve unrelated inventory-api.ts, root package files and performance-audit edits.
If implementing inventory API changes overlaps the existing user edit, preserve it
or ask before an unavoidable conflict. Never stage unrelated changes.

## Part-by-part delivery

Part 1 delivery: sidebar/mobile Inventory entry, explicit authorized branch choice,
directory/detail dropdown, active routes, normal Back to branch removal, unsaved
form confirmation, pending-write switching locks and revoked/stale-read protection.
Existing backend APIs and stock/product-creation behavior are unchanged. Frontend
lint/typecheck/build, changed-file formatting, diff checks and 443 tests across
69 files pass. Unrelated inventory API/root package/audit edits are untouched.
Rendered QA decision remains pending for this milestone. Part 3 has not been
implemented.

Part 2 delivery: strict paired optional `initialInventory`/UUID request input on
the existing owner product-create endpoint; atomic product, branch placement and
owner-attributed opening RECEIPT; minimal private nullable creation metadata with
tenant request uniqueness and database constraints. Current owner/actor/branch
checks run inside the transaction. Canonical same-command replay survives later
edits, returns the original product ID and current public identity, and never
duplicates stock; conflicting reuse is private. Serializable rollbacks require
explicit retries; concurrent unique recovery is read-only. All product response
paths exclude creation metadata. Existing product-only and zero-stock placement
behavior remains unchanged. Backend formatting/lint/build, Prisma validation/
format/generation, 301 unit tests, 116 HTTP tests and 126 disposable PostgreSQL
tests across three suites pass. Database tests verify actual rollback at each
write, concurrent no-code requests, bounds, access changes and tenant isolation;
the application database was not migrated/reset/seeded. Module documentation is
updated. Unrelated inventory API/root package/audit edits are untouched.

1. Inventory sidebar entry, authorized branch-selection/dropdown, active navigation,
   Back to branch removal and scoped form/pending guards; frontend tests/docs.
2. Atomic optional-opening-stock product-create contract, focused persistence/replay,
   authorization, migration/OpenAPI and backend unit/HTTP/PostgreSQL tests/docs.
3. Owner new-product form optional opening stock, live validation, same-command
   recovery, integration with inventory/POS reads and regression checks/docs.

Stop after each part for review. Commit only after approval, then proceed to the
next part. Archive this plan after final implementation approval and QA closure.

## Verification

Frontend format/lint/typecheck/tests/build and diff checks. Cover role/sidebar/
active routes, owner/assigned/own-only branches, empty/denied access, stale responses,
unsaved cancellation/confirmed clearing, pending switching locks, opening-section
toggle/conditional validation and safe retry/success/read-refresh handling.

Backend format/lint/build, DTO/unit/HTTP tests and real disposable PostgreSQL tests
for tenant/branch/actor isolation, unauthorized roles, exact price/integer bounds,
unknown fields, legacy product-only creation, inactive merchants, rollback at each
write, concurrent duplicate commands, unchanged/conflicting replay, products without
SKU/barcode, replay after later edits, and balanced opening receipt history.
Validate/format/generate Prisma after the narrowly scoped migration. Never migrate,
reset or seed the application database for testing.

Rendered sidebar/dropdown/product-modal responsive, keyboard/dialog and zoom QA
needs browser access or a new explicit waiver for this milestone. Previous POS and
inventory waivers do not carry over. The user approved this plan; the completed POS
refinement remains historical in its archive.
