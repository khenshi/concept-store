# Current plan

## POS Refund history and sale selection

**Status:** Implemented locally October 21, 2026. Independent review passed;
rendered browser acceptance remains outstanding. Do not treat unavailable QA as passed.

### Goal and scope

Add a branch-wide Refund history tab beside Cart and Sales History. Authorized
Owners and Managers can find saved refunds across sales and start a return
by selecting its original sale, then using the existing return form.

Keep sale-detail refund controls available. Preserve original-sale pricing,
remaining quantity checks, optional original-placement restocking, manual refund
recording and idempotent recovery. This changes discovery and entry points,
not refund financial rules.

### Confirmed user decisions

1. Include Owner/Manager history only. Merchants continue using Reports →
   Transactions for own sale/refund history and existing own-sale detail. No
   additional Merchant history tab or POS access. Cashier retains existing POS
   access without refund history or creation.
2. Entry flow: `Find sale to refund` → select original sale → existing return form.
3. Include refund-code/original-receipt search, refund date range and actual
   refund-method filtering, subject to the existing role privacy boundaries.

October 21 refinement: Reports Transactions already includes own-only SALE and
REFUND records, type filtering, code search and the applied report date range.
Preserve that existing Merchant workflow and its privacy projections unchanged.

### Repository evidence and constraints

- `PosWorkspace` and `BranchPos` maintain Cart and Sales History beneath one
  persistent POS shell. Sale details live under `pos/sales/:saleId`.
- `RefundHistory` currently owns per-sale history, returnable quantities, refund
  detail, return entry and unresolved-attempt feedback.
- Existing list/detail/create APIs are sale-scoped:
  `/organizations/:organizationId/branches/:branchId/sales/:saleId/refunds`.
- The existing list includes cumulative remaining quantities; do not reuse its
  complete payload for a branch-wide list or fetch every sale in the browser.
- Frontend refund decoding verifies original-sale identity/item snapshots.
  Preserve these checks when resolving detail from branch history.
- Shared operational tables, calendar, dropdown, pagination and dialogs exist.
  Reuse their contracts and visual treatment.
- Preserve existing uncommitted POS/refund changes and establish a baseline
  before implementation. Planning does not authorize unrelated cleanup.

### Navigation and history table

- Add `.../pos/refunds` with a `Refund history` tab for the confirmed roles,
  including fullscreen POS. Direct route access enforces the same permissions.
- Owner/Manager see `Find sale to refund` in the table title/action row.
  Merchant and Cashier cannot access this tab or sale-selection workflow.
- Put labeled search, shared date picker and staff method dropdown on the muted
  filter row. Calendar supports one date, a range, Apply and Clear dates.
- Default to all accessible refunds, newest first, using bounded pagination.
  A single date means exactly that Manila calendar day. Clearing dates restores
  unrestricted dates within the authorized paginated scope.
- Columns: Refund code, Original receipt, Refunded at, Method, Amount, Action.
- Use refund completion time and actual refund method, independently of the
  original sale date/payment. All saved refunds are completed; no status filter.
- Default 15 rows/page; use shared pagination, current/total pages, refund count,
  separator and borderless arrows, including the standard empty-state treatment.
- View opens the existing immutable refund-detail presentation. Resolve its
  authorized original sale and verify saved snapshots first. Link to the original
  role-appropriate sale detail; do not stack detail and return dialogs.
- Use route query state for applied filters/page and selection/detail identity.
  Refresh and browser Back restore context. Define the exact query keys before
  implementation; parse/normalize malformed queries without expanding access.
- Reset page on filter changes. Clear old branch/actor/role results before reads;
  stale requests cannot restore them. Preserve list context while viewing detail.
- Distinguish initial loading, no refunds, no matches and retryable read errors.
  A failed read never initiates a refund command.

### Sale selection and refund creation

1. `Find sale to refund` opens a selection view within Refund history, avoiding
   stacked selector/return dialogs. Reuse the existing paginated Sales API and
   receipt search. Show receipt, original completion date and original total.
2. Selecting a sale loads authorized sale detail and fresh cumulative remaining
   quantities, then opens the existing return form with clear receipt context.
   Do not infer return eligibility from the branch list or original sale total.
3. If nothing remains returnable, explain that state and allow another selection.
   Cancel returns to the preserved selection/history context.
4. Successful completion refreshes history/remaining quantities and shows the
   saved refund code. Preserve filters even when the new refund falls outside
   them; provide completion feedback without silently resetting filters.
5. Reuse the organization/user-scoped pending attempt and original-sale recovery
   path. Unknown outcomes retain the exact command/request ID for explicit retry.
   No new command, automatic POST retry or money operation is introduced.
6. Tab changes, selection changes, Back, branch changes and fullscreen navigation
   must respect existing checkout/refund locks. Preserve the active cart and
   existing other-sale unresolved-attempt handling. A follow-up read failure
   offers GET retry and never repeats creation.

Inspect existing POS navigation event handling: it currently recognizes Cart
and Sales History. Extend it narrowly for the new route and selection states.
Extract only the minimum feature-owned presentation/controller needed to reuse
the existing return dialog and detail; avoid a general workflow framework.

### Backend and frontend contract

Add `GET /organizations/:organizationId/branches/:branchId/refunds`. Retain
all existing sale-scoped endpoints and their response/command compatibility.

- Pagination: page defaults to 1, limit defaults to 15 and caps at 100; finite
  page bounds follow existing refund query conventions.
- Optional search matches refund code OR original receipt, using case-insensitive
  literal substring semantics. Set a finite length bound aligned with Sales
  History. Treat search text as data, including SQL wildcard characters.
- Optional `from` inclusive and `until` exclusive UTC bounds must appear together;
  validate ordering and supported bounds. Convert inclusive Manila calendar
  selections with the shared date utilities. Missing bounds means no date
  predicate, not an unbounded response payload.
- Authorized staff may filter by the existing actual payment-method enum.
  Reject unknown query fields and malformed parameters using existing DTO rules.
- Staff summary rows contain refund ID/code, original sale ID/receipt, branch/
  organization scope, completion time, actual method and exact decimal total.
  Return pagination totals; omit item arrays, reason, reference and private command.
- The new endpoint has no Merchant projection; deny Merchant access. Preserve
  existing reduced Merchant Reports and sale-scoped refund responses unchanged.
- Stable sort: completion timestamp descending, then ID descending. Count/page
  predicates must match and use a consistent database snapshot. Keep amounts
  exact; do not calculate subtotals with JavaScript floating-point arithmetic.
- Reuse current membership and branch authorization: Owner in tenant branches,
  Manager in assigned branches. Merchant and Cashier denied.
  Inaccessible tenant/branch/sale/refund objects retain existing
  not-found behavior. Access changes must be respected on every read.
- Inspect existing branch/time and merchant indexes; measure representative
  queries before proposing migrations. Never aggregate all sales client-side.
- Extend DTO/OpenAPI, strict frontend schemas and API tests together. Validate
  role projection, response scope, page metadata and duplicate refund IDs.
- Opening detail may reuse existing original-sale and refund-detail GETs. Preserve
  original snapshot validation and clear restricted content after access denial.

### Exclusions

No payment-provider operations, discretionary amounts, exchanges, return windows,
refund editing/deletion/printing, new Cashier permissions, cross-branch history,
export, extra reporting dashboard, new infrastructure or dependencies. No schema
change without demonstrated query need and an explicit plan update. No broad
POS/sales refactor or unrelated dirty-worktree fixes.

### Delivery sequence after implementation approval

1. Finalize route/query keys and bounded search/date validation against existing
   utilities. Record any material deviation here; establish focused baselines.
2. Implement staff branch-list queries, DTOs, OpenAPI and
   authorization/privacy tests, with representative disposable database fixtures.
3. Implement frontend staff API/schema contracts and shared history table.
4. Add POS route/tab, detail resolution and retained query/navigation state.
5. Add staff sale selection and existing return-form entry with recovery locks.
6. Validate, review authorization and command recovery independently, then update
   `docs/modules/refunds.md`, `docs/modules/pos.md` and affected frontend docs.
7. Archive this plan after acceptance, recording any unperformed browser checks.

### Acceptance and verification

- Combined search/date/method filters operate on refund fields, including refunds
  whose original sale is outside the date range; cleared dates and one-day ranges
  have correct Manila boundaries.
- Stable ordering, 15-row pages, totals, empty/no-match states, first/last pages
  and multiple refunds for one sale behave correctly.
- Test unauthenticated access, denied Cashier, foreign tenant/branch guesses,
  unassigned Manager, changed membership/branch grants and wrong-sale detail IDs.
- Verify Merchant is denied the new history endpoint and POS route/tab, while
  existing Reports Transactions still lists only own sale/refund amounts and
  existing own-sale refund detail remains accessible. Retain privacy regressions.
- Test deep links, refresh/Back, filter/page restoration, cart retention,
  fullscreen, stale reads and actor/branch/role changes during requests.
- Test selection cancellation, exhausted sales, fresh quantities, successful
  return, completion outside current filters and detail access revocation.
- Preserve concurrent over-return, exact totals, atomic restocking and existing
  idempotency tests. Add focused tests for the new entry and navigation paths,
  especially ambiguous outcomes and unchanged-command retries across tabs.
- Use disposable PostgreSQL integration fixtures for count/filter/privacy and
  query plans; record fixture size, timing and payload observations. No production
  writes. Obtain an independent review of access and attempt-handling changes.
- Run affected unit/API/integration suites, lint, typecheck and relevant builds;
  inspect final diff. Report baseline failures separately, preserving user edits.
- Browser QA: desktop/mobile/fullscreen, keyboard and focus return, long labels,
  calendar overflow, dialog scrolling and loading/empty/error states. Static
  checks do not establish rendered behavior; report unavailable checks explicitly.

### Implemented route and recovery decisions

October 21 nested Reports routes approved: replace local-only tab switching with
`reports/overview`, `reports/transactions`, `reports/daily-data` and
`reports/rankings` beneath one persistent Reports layout. Keep the shared header,
branch selection and report-period controls. Preserve report calculations,
authorization, Merchant projections and refund-details modal. Retain applied
period and tab-specific filters/pages in URL query state for refresh, direct
links and Back/Forward. The existing branch Reports URL redirects to Overview;
branch switching retains the selected tab and period and resets branch-specific
filters. Use existing dependencies and server contracts. Verify the same focused
Reports/refund tests before and after, plus route/state regression tests.

October 21 follow-up approved: Reports Transactions refund View/row activation
opens the existing read-only refund-details modal within Reports. Sale rows keep
their existing navigation. Extract the existing dialog for reuse, load the
authorized original sale before refund detail, preserve Merchant projections,
and discard obsolete reads on modal/context changes. No new API or refund command.
Implemented using the extracted `RefundDetailsDialog` in both history and
Reports. All 126 focused refund/transaction tests, frontend typecheck and focused
lint passed. At that handoff, broader Reports retained three removed-label test
failures; the nested-route work subsequently replaced those stale assertions with
visible calendar and URL-state checks while preserving date/access coverage.

Nested-route verification: one standard agent implemented/tested URL parsing and
reviewed the route integration. Initial review found queryless Back period loss,
search-draft resurrection, stale ranking errors and whitespace-only search
invalidation. Those were fixed with regression coverage; focused re-review found
no remaining issues. The Reports workspace suite now passes all 44 tests.
Frontend typecheck, focused lint and formatting pass; production build includes
all four nested routes. Final regression run passed 322 tests across 17 Reports,
affected refund and organization-navigation suites; the final production build
and diff checks passed. The prior three Reports label failures are resolved by
the new route/calendar assertions, without restoring the manually removed UI.
No backend/schema/dependency changes were needed for this routing refinement.
Rendered browser QA remains unavailable and is not implied by automated checks.

- Applied history state uses `q`, `method`, `fromDay`, `throughDay`, `page`.
  Selection uses `select=1`, `saleQ`, `salePage`, `sale`; saved detail adds `refund`.
  Search caps at 254 characters; page bounds match the existing refund API.
- A branch summary omits item arrays; detail reads reuse authorized source-sale
  and existing refund-detail APIs with original snapshot checks.
- Reuse `RefundHistory` entry props to open the existing return/detail dialogs.
  The command and write endpoint remain unchanged.
- Retained attempts pin the sale subtree through query Back and completed read
  acknowledgement. The persistent POS layout substitutes original-sale recovery
  on Cart/History browser transitions. This retention is limited to the mounted
  POS layout; attempts retain the existing memory-only lifecycle contract.
- Remounted dialogs use external attempt state for externally pending requests;
  only locally started requests own local pending/busy flags. This prevents a
  pending remount from permanently disabling explicit same-command retry.

### Local verification and remaining acceptance

- Backend: 73 focused unit tests, 82 refund HTTP/OpenAPI tests and 44 disposable
  PostgreSQL refund integration tests passed, including changed access, literal
  wildcard searches, date bounds and concurrent count/page snapshot consistency.
  Application build, focused lint/formatting and diff checks passed.
- Disposable fixture: 1,500 refunds, 15-row response 4,068 bytes, observed 5.4 ms
  unfiltered / 7.4 ms filtered. EXPLAIN used `Refund_branch_reports_idx`;
  no schema, index, dependency or infrastructure addition was needed.
- Frontend: production build, typecheck and focused lint passed. All 179 tests
  in the final focused refund/POS workspace/branch POS/sales-workflow run passed,
  including date-boundary and exhausted-sale cases.
  Coverage includes pending remount, query Back retention, failed completion
  acknowledgement GET retry, same-command explicit retry and cart retention.
- Two pre-existing POS workspace assertions were updated to exercise the current
  calendar and 15-row pagination while preserving their behavioral assertions.
- Broader frontend run: 292/293 passed. The untouched `pos-cart.spec.ts` expects
  `Only 1` while untouched `pos-cart.ts` emits `max quantity for ...`; leave this
  unrelated message mismatch separate from the delivered work.
- Broader backend checks found existing inventory HTTP pagination assertions,
  a sales integration pagination assertion and repository test typing failures;
  these are outside this plan. Production build and focused refund checks pass.
- Independent deep frontend review found pending/Back recovery, completed
  acknowledgement and inherited-pending known-rejection issues; fixes and
  regression tests were added. The reviewer confirmed no remaining findings
  after inspecting frontend fixes and backend authorization/query contracts.
  The final inherited-pending fix passed all 18 refund-dialog tests independently.
- Backend full test-inclusive typecheck reports 25 errors across six existing
  test files; no pre-edit full run was recorded. The existing refund fixture
  diagnostic was confirmed in HEAD. No production build failure was introduced.
- The disposable PostgreSQL container was created for this task, isolated test
  schemas were removed after tests, and the container was stopped after review.
  No production data was changed.
- Browser inventory exposed no enabled browser surface; opening Chrome returned
  `Browser is not available: chrome`. Desktop/mobile rendered, keyboard/focus and
  visual QA were not performed. Keep this current plan until acceptance or an
  explicit rendered-QA waiver; no waiver is inferred.

### Prior plan

The previous Reports plan is preserved in
`archive/reports-period-presets-superseded-2026-10-21.md`. Its outstanding rendered
QA and test-label mismatches are not resolved by archival. POS and refund module
documentation now describes the implemented branch-history workflow.
