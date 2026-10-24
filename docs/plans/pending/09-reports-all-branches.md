# Plan 09: Sales Reports All Branches

Moved from the deferred archive to pending on October 23, 2026. This feature is
not completed or cancelled. Review this specification at planning queue item 09;
implementation remains deferred until the planning batch is finished and the
specific scope is approved. See [planning sequence](README.md).

## Sales Reports: All Branches

Date: October 22, 2026; source-reviewed and updated October 24, 2026

Status: Planning only. User requested a plan first; implementation is not authorized.

Priority: Required before real pilot use. Plan 08 owns Payment Accounts and must
coordinate its account-aware reporting contract before launch. No application or
database change is authorized by drafting this plan.

### 1. Goal and confirmed scope

Add an explicit All branches option to Sales Reports only. Aggregate the existing
Overview, Transactions, Daily Data and Rankings within current authorized scope.

User-confirmed roles:

- OWNER: all report-accessible branches in the current organization.
- MANAGER: currently assigned/access-permitted branches only.
- MERCHANT: own-item activity across branches accessible under existing Reports
  policy. Assignment alone never grants another merchant's financial data.
- CASHIER: still denied Reports.

All branches means all authorized branches, never all database records. Show scope
guidance for restricted roles without revealing inaccessible branch identities.

Exclude other selectors/pages (POS, Inventory, Spaces), shared preference changes,
checkout/refund writes, payment account implementation, settlements, reconciliation,
new dependencies/infrastructure and schema changes unless a measured index need is
separately approved. Payment Account Management remains owned by required Plan 08.

### 2. Repository evidence and gaps

- `frontend/src/features/reports/components/report-branch-picker.tsx` only accepts
  real branch IDs from the authorized identity lookup.
- `reports-entry.tsx` resumes a valid shared selectedBranchId or requests explicit
  selection; this preference is also used by POS/Inventory.
- `branch-reports.tsx` and nested routes assume a branch ID for APIs, period
  resolution, filter URLs, sale links and refund dialogs.
- `backend/src/modules/organizations/reports/reports.controller.ts`, report service,
  DTOs and analytics queries are branch-scoped. Reports module docs explicitly say
  there is no All Branches total today.
- Existing periods, All Time server resolution, exact sums, merchant projections,
  bounded analytics and 15-row pagination are reusable requirements, not replaceable
  by downloading every branch's history into the browser.

### 3. Frontend scope, routes and navigation

Use an explicit Reports scope union: `{ kind: 'branch', branchId }` or
`{ kind: 'all' }`. Never pass `all` to a UUID API or interpret a missing/malformed
branch as unrestricted access.

Proposed aggregate routes:

```text
/app/organizations/:org/reports/all/overview
/app/organizations/:org/reports/all/transactions
/app/organizations/:org/reports/all/daily-data
/app/organizations/:org/reports/all/rankings
```

Preserve the organization Reports entry and all single-branch nested URLs. Reuse
the shared persistent Reports header/workspace/tabs, not a parallel dashboard.
Both entry and workspace selectors offer All branches after authorization loads.

- Keep current initial/default selection behavior. All is explicit, not a silent
  default or fallback for an inaccessible remembered branch.
- Preserve active tab and applied bounded dates on branch/all changes; reset
  transaction/daily/ranking pagination. Retain only filters valid in the new scope.
- All Time re-resolves earliest accessible sale/refund activity in the new scope.
  Bounded/custom dates remain selected. Empty scope/activity has explicit zero/empty
  metadata, without leaking another tenant's or merchant's earliest dates.
- Preserve query parameters and back/forward navigation. Store All selection in
  Reports URL only; never write `all` into shared branch context/storage or erase
  another feature's real preferred branch. Choosing a real branch retains existing
  preference behavior.
- Keep header/filters stable while content reloads; reject stale scope responses.
  Existing pending/unknown POS checkout/refund navigation guards still apply.

### 4. Backend contracts and access

Add explicit aggregate routes alongside unchanged branch routes:

```text
GET /organizations/:org/reports/sales/all/period
GET /organizations/:org/reports/sales/all
GET /organizations/:org/reports/sales/all/analytics
GET /organizations/:org/reports/sales/all/daily
GET /organizations/:org/reports/sales/all/rankings
GET /organizations/:org/reports/transactions/all
```

Reuse existing strict date/search/page/ranking validation and update OpenAPI and
frontend runtime schemas together. Route structure must not collide with the
existing `reports/sales/branches` lookup or UUID branch endpoints.

Inside each read transaction, resolve fresh membership, active user, branch grants
and merchant link using existing Reports authorization semantics. Derive the allowed
branch predicate/IDs server-side; do not trust client role/branch lists. Authorized
empty branch scope produces an explicit empty report; forbidden role/organization
still gets the existing denial. Every source/count/summary/filter/period query includes
organization and current allowed branches. Merchant queries additionally retain
own-item predicates and reduced projections (no whole-sale totals, payment fields,
other merchants or actor information). Preserve historical access rules.

Use consistent read snapshots for rows/counts/totals. Never aggregate separately
fetched branch snapshots and claim transactionally consistent results. No writes.

Return an explicit aggregate response identity, such as `reportScope: 'ALL'`,
separate from the existing STAFF/MERCHANT projection discriminator; it must not
masquerade as a fabricated branch object. Keep existing branch response contracts
compatible. Aggregate transaction rows include real `branch: {id,name,code}` with
shared safe metadata for staff and own-item Merchant projections. Do not include a
full organization branch list or account assignment list in summary metadata.

Empty authorized scope returns zero summary/empty transactions/rankings and
defined zero-filled bounded date rows; ALL_TIME retains its no-activity period
representation. Permission denial is not an empty result. Update strict schemas
and test empty-date pagination explicitly.

Per-request consistency does not imply all tabs use one database snapshot. Freeze
period bounds per scope and reject stale client results, but later requests may
reflect newer commits. Do not add a snapshot store, long-lived transaction or
cached authorization to synchronize tabs. Access changes apply on fresh reads.

### 5. Aggregate semantics and detail actions

- Summary: exact Sales and Refunds sums within authorized branches and `[from,until)`;
  each stream uses its own completion date. Preserve gross/refunded/net semantics.
- Daily/hourly: group into existing Asia/Manila buckets and granularity across all
  permitted branches; fill zero buckets once. Compute ratios/averages from aggregate
  numerators/denominators, not averages of branch averages.
- Transactions: one server-paginated merged SALE/REFUND stream, globally ordered by
  completion time and stable type/ID tie-breakers. Count/page the whole query, default
  15 rows. Include safe actual branch identity/name and an aggregate-only Branch column.
- Sale/refund actions: use each source row's real branch ID, never an aggregate
  sentinel. Keep in-page refund details and preserve aggregate Transactions returnTo
  with dates/filters/page. Explicitly extend the existing safe return validator for
  same-organization aggregate paths; do not accept arbitrary/external return URLs.
  Navigation hints never grant source access.
- Rankings: aggregate by product identity across authorized branches before sorting
  and global pagination. One product sold in two branches is one ranked product;
  do not sum branch top-N lists. Preserve historical saved names and merchant filters.
- Top charts/distinct counts: compute full-scope top products/merchants and distinct
  products/merchants from source rows, not summed branch distinct counts or truncated
  charts. Avoid sale/refund/item joins multiplying amounts.
- Coordinate with required Plan 08: group stable account IDs across branches and
  subtract actual refund-account flows;
  never count a shared account's branch assignments as extra transactions. That
  separate feature is not independently implemented by this plan. Do not permanently
  encode original-sale-method net attribution in new aggregate acceptance tests.

Use exact Decimal/PostgreSQL numeric aggregation and amount strings, never floating
point money. Preserve bounded analytics for long/All Time ranges and pagination.
Apply identical scope to earliest activity, summaries, counts, rows and filter options.
Prefer scoped SQL predicates/joins to one query per branch or unbounded ID payloads.
Measure representative SQL plans before proposing any index; no cache/jobs needed.

### 6. Phased implementation

1. Finalize explicit scope and response branch metadata, aggregate route contracts,
   scope transitions and source-detail return paths; capture baseline checks.
2. Backend scoped aggregation: period, summary, analytics, daily, rankings and
   Transactions, with strict DTOs/OpenAPI and unchanged single-branch endpoints.
3. Reports-only selector/routes: shared persistent workspace, all/branch dispatch,
   date/filter/page transitions and shared-preference isolation.
4. Branch column, actual-source detail/refund routing, safe returnTo restoration,
   global chart/ranking/count semantics and empty/loading/error feedback.
5. Focused/full regression, disposable PostgreSQL/performance checks, build and
   browser QA; update reports.md only after behavior is implemented.

No database reset/migration, code or dependency modifications during planning.

### 7. Verification and acceptance

- Unit/HTTP: authentication, forbidden Cashier, foreign organization/branch, current
  Owner scope, Manager assignments, Merchant own-only/relink/unlink, membership or
  branch access revoked between selection and fetch, malformed/unknown queries.
- Disposable PostgreSQL: two tenants/multiple branches, shared products/merchants,
  tied timestamps, partial/multiple/different-date refunds, refund-only periods,
  inactive historical records, no activity and empty authorized branch sets.
- Prove globally merged pages/counts/top-N/distinct counts against direct SQL ground
  truth, including more than 15 source rows/products and cross-branch page boundaries.
  Account for full precision and avoid duplicate records through joins.
- Date tests: aggregate All Time earliest activity remains access-scoped; bounded
  dates persist; single-day hours and long-period buckets retain exact totals.
- Frontend: Reports-only option, direct routes/back-forward, query preservation,
  valid filter resets, stale-response rejection, shared branch preference unchanged,
  no unauthorized old-scope data while loading and correct empty/retry feedback.
- Detail tests: actual source branch, scoped refund modal, aggregate returnTo restored,
  foreign/external return targets rejected and pending/unknown navigation locks intact.
- Regress single-branch Reports, POS/Inventory branch selectors, merchant privacy,
  receipts/refunds and legacy routes. Run lint/typecheck, applicable unit/HTTP/
  integration suites and production builds. Report unrelated baseline failures.
- Browser: desktop/mobile dropdown/calendar overflow, keyboard/focus, Branch column,
  table/chart alignment, loading/empty/error and 200% zoom. Static checks do not
  prove rendered behavior. Disclose unavailable QA; a waiver records missing evidence,
  not equivalent proof of passing 11/14 launch acceptance.

Acceptance: All branches shows accurate complete Reports across exactly authorized
scope; every tab/detail action works; date/navigation state is coherent; other
pages' selectors and behavior are unchanged.

### 8. Prior plan and remaining design details

Prior current plan/UI follow-up notes are preserved in
`archive/superseded-current-pos-refunds-and-ui-followups-2026-10-22.md`.
Outstanding rendered QA remains pending; supersession is not completion.

All existing Reports roles within their scope is user-confirmed. Existing default
selection is preserved; global product ranking and aggregate Branch column are
proposed consistent behavior. Confirm any material contract ambiguity before edits.

Plan checks: repository/module inspection and document whitespace checks only.
No runtime implementation or acceptance tests performed for this proposal.

### 9. October 24 source review and cross-plan contracts

Fresh source inspection covered ReportsController/ReportsService, analytics SQL,
ReportsEntry/ReportBranchPicker, route inventory and relevant implemented docs:

- Existing routes are UUID-branch-only. ReportBranchPicker rejects IDs absent from
  returned choices and disables itself with no branches; adding an option alone
  will not implement All Branches or its authorized empty state.
- ReportsService refreshes current membership in repeatable-read queries.
  `reportBranchScope` preserves current merchant branch access OR branches with
  saved sales for the currently linked merchant. Keep that historical union;
  active affiliations alone would drop valid own history.
- Rankings group by stable product ID and choose saved snapshot labels
  deterministically. Expand that existing rule, not product-name grouping.
- No fresh tests, build, database or browser checks ran for this planning review.
  Existing module docs remain current-behavior descriptions, not feature proof.

Dependencies and boundaries:

- **03/07:** verified identity, current membership and permitted tenant access on
  every endpoint. Inactive organizations retain authorized read-only history;
  no new writes, Owner self-activation or public tenant provisioning.
- **08:** use identical branch/date predicates for account and report totals.
  Historical contributions survive account disable/reassignment; current account
  assignments cannot expand branch access. Managers receive no inaccessible
  branch/account identities; Merchants still receive no whole-account totals.
- **16:** retain inactive-branch history. New-operation restrictions are not
  blanket historical report filters; policy changes remain owned by 16.
- **17:** server pagination stays 15 by default; no browser-side full-history
  download for global counts, sorting or ranking.
- **18:** actual-source detail navigation preserves unresolved command safety.
  Viewing reports/refunds never submits a return, payout or command retry.
- **19:** optional exports later reuse scope resolution, not unbounded endpoints.
- **04/06/12:** disposable tests, enforced gates and measured query budgets. No
  schema change presumed necessary; propose indexes only with SQL-plan evidence
  and approved migration. No cache, job or extra infrastructure.

Extract only the narrow report-scope resolver/predicate shared by existing
single-branch and aggregate reads. Do not duplicate all SQL/services or build a
generic cross-module analytics framework. Apply authorization before grouping,
top-N and pagination. Source joins preserve organization/branch ties and merchant
own-item predicates, including refund-source joins.

Invalidate role-sensitive client results on user/tenant/access-generation/scope/
period/filter changes. Old requests cannot restore revoked data. On inaccessible
detail or branch, show safe unavailable feedback and refresh authorization; never
fall back to a broader scope or silently redirect to POS. Keep load failures
retryable with the selected scope/period, without destroying unresolved commands.

Implement in order: agree scope/period/account response contracts; shared backend
predicates and tests; aggregate endpoints; thin aggregate routes reusing workspace;
detail return navigation; precision/performance/browser gates. Update reports and
relevant frontend/navigation module docs only after implementation. Preserve
single-branch API behavior, existing visual design and other page selectors.

Rollback can withdraw aggregate UI/routes while retaining compatible single-branch
history and explicit fallback feedback for saved aggregate links. Never reset data,
undo Payment Account schema changes, broaden access or interpret missing branch
as unrestricted scope. Preserve safe returnTo validation and actual source access.

Remaining gates: exact aggregate response metadata, empty-date pagination and
measured query budget. No new business clarification is required for this draft;
global product grouping and the aggregate Branch column remain explicit proposed
behavior to review before implementation. Browser and launch acceptance belong
to 11/14, not documentation checks.
