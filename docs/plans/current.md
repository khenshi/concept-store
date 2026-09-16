# Current Implementation Plan

**Status:** Approved September 17, 2026. Deliver in reviewable parts.
Stop each part uncommitted for review, then commit and begin the next part only
after approval.

## HTTP test reliability and bounded Inventory browsing

### Goal and existing behavior

Remove two known hardening gaps before adding another feature: intermittent
401/404 responses in backend HTTP tests, and the unbounded branch Inventory
directory. Preserve tenant/branch access, product-placement eligibility,
stock-status rules, search behavior, existing writes and POS behavior.

The completed [Inventory/POS measurements](../development/inventory-pos-performance-2026-09-16.md)
show the unfiltered directory returning all 5,000 placements in about
127–132 ms on a disposable fixture. Status filters and health counts have
already been moved to PostgreSQL, and movement history is paginated. The
Inventory Add product placement form currently fetches the full directory to
exclude placed products, alongside active products and merchants. Simply
limiting the directory would make already-placed products appear eligible.

Repeated full HTTP-suite runs sometimes returned unexpected 401/404 statuses
in Reports and Products/Inventory tests, while focused reruns and later full
runs passed. The cause is not established; do not assume a production auth bug
or silence it with retries.

### Approved scope

1. **Diagnose and fix HTTP-suite instability.** Reproduce failures with
   repeatable full and focused runs, capturing test order/seed, failing route,
   response body, guard result and relevant mock state without leaking tokens.
   Determine whether the cause is test setup/isolation, an asynchronous request
   lifecycle, or actual runtime routing/auth behavior. Make the smallest
   evidence-backed fix in the responsible boundary. Do not loosen expected
   401/403/404 behavior or add blind retries. Run repeated suites after the
   fix and document the observed failure rate and remaining uncertainty.
2. **Bound the Inventory directory API.** Change branch Inventory listing to
   a bounded page response (default 50, maximum 100) with deterministic
   product-name/placement-ID ordering and a next cursor. Scope each page and
   cursor to the authenticated organization, authorized branch, role-visible
   placements, and active filters. Missing, foreign, unassigned or incompatible
   cursors must not reveal data. Existing search, merchant/product/stock-status
   filters, price/status projections and ordering remain equivalent. Do not
   materialize all matching placements in server memory. Document the changed
   API/OpenAPI contract and update its consumers.
3. **Replace the placement picker's full-list dependency.** Provide a bounded,
   branch-scoped, searchable list of products eligible for placement: active
   product and merchant, visible under the role's existing product scope, and
   not already placed in that branch. Owners and assigned managers may use it;
   merchants and cashiers may not. Keep name/SKU case-insensitive and barcode
   case-sensitive search, stable ordering and paged access to all eligible
   results. The existing create-placement endpoint remains authoritative and
   returns its normal conflict when another user places the product first.
   Avoid widening managers' product visibility through this new read.
4. **Frontend continuity.** The Inventory directory loads one page initially,
   provides an accessible Load more action, and resets pages/cursors after
   branch, organization, user, role, filter, access or successful write changes.
   Show a truthful displayed-row count without claiming it is the total when
   more pages remain. Keep loading, empty, error and retry states, and ignore
   stale responses. The Add product placement picker uses the eligible-product
   read, retains debounced search, keyboard/focus behavior and form validation,
   supports more results without fetching all inventory, and clears stale
   candidates on context changes. Do not change navigation or visual design.

### Security and consistency

- Backend guards and service checks remain the authorization boundary. All
  tenant-owned queries include `organizationId`; branch-owned queries also
  include `branchId`. Manager assignments and merchant-own boundaries are
  preserved. Guessed foreign objects and cursors behave like absent ones.
- DTO whitelisting rejects unknown fields; page sizes and cursor shapes are
  bounded/validated. Pagination must not leak another role's products or allow
  a cursor from different filters to silently widen results.
- Product eligibility is advisory under concurrency; the unique branch/product
  constraint and create command still decide whether a placement can be made.
  A candidate read never changes stock, price or lifecycle.
- Directory status filters and health summary keep identical stock rules for
  zero thresholds and boundary quantities. No inventory movement, checkout,
  refund, reconciliation or POS contract changes are intended.

### Delivery by reviewable parts

1. **HTTP reliability.** Establish a reproducible diagnostic, correct its
   proven cause, and add focused regression coverage. Repeated full HTTP runs
   must be stable without relaxing security assertions. Stop uncommitted.
2. **Bounded backend reads.** Implement/test the Inventory page and eligible-
   product contracts, authorization, cursor/filter isolation, concurrency
   conflict preservation, OpenAPI and module docs. Use disposable PostgreSQL
   scale and cross-tenant/role tests. Stop uncommitted.
3. **Inventory frontend adaptation.** Paginate the directory and picker with
   accessible controls and stale-read protection. Cover search, branch/role
   switches, error/retry, duplicate-race feedback and keyboard behavior in
   automated tests. Stop uncommitted.
4. **Final verification.** Compare representative Inventory plans/timings on
   the same disposable fixture. Run formatting, lint, type checks, unit, HTTP,
   PostgreSQL integration and production builds. Validate/generate Prisma if
   a schema/index change is justified. Perform rendered responsive, keyboard/
   focus and 200% zoom QA if a browser is available; otherwise obtain a fresh
   explicit waiver. Update `docs/modules/`, stop for final review, then commit
   and archive only after approval.

### Part 1 verification (committed as `acb7c80`)

The intermittent statuses reproduced during repeated full HTTP runs: one
Products/Inventory 200 became 404 in 10 baseline runs; a later authorized
sales 200 became 401, and a forbidden stock write 403 became 404. When only
the Products/Inventory and Reports suites used a persistent listener, a
Refunds 400 became 404 in 7 full runs. These failures crossed routes, guards,
and suites while the requested security behavior remained stable on reruns.

All six HTTP suites now start their Nest application on an ephemeral
`127.0.0.1` port once in `beforeAll` and close it in `afterAll`, instead of
letting Supertest listen/close on each request. This is a test-harness-only
change; no runtime authorization or expected HTTP status was changed. The
full suite then passed 30 consecutive runs (213 tests per run), as did backend
lint and build. This supports a request-listener lifecycle cause, though an
intermittent failure cannot be ruled out absolutely by finite repeated runs.

### Part 2 backend read status (committed as `af48532`)

The branch directory now returns a bounded `{ items, nextCursor }` page,
ordered by product name and placement ID. The staff-only eligible-product
endpoint returns the same shape ordered by product name and ID. Both default
to 50, cap at 100, query only `limit + 1` rows, and validate cursor existence
inside the same tenant, branch, role/member scope and filters. The manager
picker does not widen the existing product scope; placement creation keeps its
database-backed duplicate conflict. The OpenAPI and module contracts have
been updated.

Validation so far: 413 backend unit tests, 214 HTTP tests, 245 PostgreSQL
integration tests (one pre-existing skip), backend lint and build passed. A
129-placement branch fixture traversed all pages without duplicates. The
frontend had not yet been adapted at the end of this reviewed part.

### Part 3 frontend status (uncommitted, awaiting review)

The Inventory directory now loads 50 placements initially, appends later pages
on demand, labels displayed versus complete row counts truthfully, and clears
old pages after filter/context changes or successful writes. The placement
combobox now reads the branch-scoped eligible-product pages rather than full
product, merchant and inventory lists; its debounced search, later-page
selection, pending/error feedback and duplicate-conflict draft retention remain.
Generation checks ignore responses from superseded reads. Focused API/UI tests
and the full 783-test frontend suite pass, as do lint, sequential typecheck and
production build. Rendered QA is reserved for the final verification part.

### Explicit exclusions

- No general Product-list pagination, organization-wide search framework,
  cache, Redis, queue, new infrastructure or unrelated module optimization.
- No stock repair, transfer, new inventory movement type, changed role model,
  checkout/refund change or speculative database index. Add an index only if
  measured query plans justify it.
- No blanket changes to authentication policy merely to make a flaky test
  green. If a genuine production security defect is proven, fix only that
  defect with direct regression tests and call it out for review.
- Preserve unrelated root `package.json`, `package-lock.json`, and the
  untracked performance-audit draft.

### Acceptance checks

- Repeated full HTTP runs no longer show the observed intermittent statuses,
  with an identified cause and no weakened authorization expectations.
- A large branch Inventory first page and each later page have bounded server
  row materialization, complete deterministic traversal and no duplicate or
  missing placements in an unchanged dataset. All prior filters and role views
  yield the same set and order when all pages are combined.
- The picker finds every eligible product through search/pagination, never
  offers already-placed products in a stable dataset, and still handles a
  concurrent placement conflict safely.
- Owner, assigned-manager, merchant, cashier and foreign tenant/branch tests
  verify that neither pages nor cursors widen access. The existing stock,
  sales, refunds, reconciliation and POS regressions continue to pass.
