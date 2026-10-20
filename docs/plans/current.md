# Current plan

## Reports period presets and all-time reporting

**Status:** Implemented locally October 19, 2026. Automated correctness,
performance and independent deep review passed. Rendered browser QA remains
unavailable in this session; retain this plan until that acceptance step is done.

### Goal

Make common reporting periods easy to select and support all available sales
and refund history within the existing authorized branch and merchant scope.
Use one applied period across all Reports tabs.

### Current constraints

- Frontend date validation, runtime response schemas and backend validation
  currently enforce a maximum period of 366 days.
- Requests use explicit UTC `from` inclusive and `until` exclusive bounds;
  the UI selects inclusive Asia/Manila calendar dates.
- Analytics returns zero-filled daily rows for the entire period.
- Summary totals aggregate the complete matching period in PostgreSQL.
  Transactions and rankings remain server-paginated.
- Sales use completion dates; refunds use their own completion dates, including
  refunds for older sales. Net recorded sales is not profit.

### Confirmed periods

| Preset         | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| Today          | Current Philippine calendar day                            |
| This month     | First day of this month through today                      |
| Last 30 days   | Today and the preceding 29 calendar days                   |
| This year      | January 1 through today                                    |
| Last 12 months | Rolling 12 calendar months ending today                    |
| Last 2 years   | Rolling 24 calendar months ending today                    |
| All time       | Earliest accessible completed sale or refund through today |
| Custom dates   | User-selected inclusive date range                         |

### Confirmed interaction

October 20 refinement approved: place preset and calendar selectors in one row,
reuse the shared custom dropdown, and apply presets immediately without a
separate Apply button. Custom calendar edits continue to require Apply.
The shared calendar Apply action uses the filled primary treatment; Reports
labels that action simply `Apply`.
The Period label matches Report dates: muted, extra-small, medium weight with
the same label-to-control spacing.

- Keep Today as the initial default.
- Add presets beside the existing shared calendar in one row. Selecting a preset
  applies it immediately; custom calendar edits remain pending until Apply.
- Show the selected preset and actual inclusive dates in the report context.
- Refresh/retry uses the applied concrete bounds without silently shifting them.
- Apply identical bounds to Overview, Transactions, Daily Data and Rankings;
  reset affected pagination and retain existing stale-response protection.
- Preserve staff and own-only merchant projections. All time never broadens
  branch, organization or merchant access.
- Keep report-specific preset behavior in Reports, outside the shared calendar.
- Preserve the selected preset or Custom dates when switching branches. Retain
  the applied concrete dates for bounded periods; resolve All time again within
  the newly authorized branch scope. Clear old branch results while loading.

### Confirmed decisions

1. Include all eight listed period options, with Today as the initial default.
2. Rolling periods look backward from today. Inclusive
   rule: subtract 12/24 calendar months from tomorrow's Manila date, clamp invalid
   month days, then include through today. Test month ends and leap days.
3. Use monthly chart buckets for
   periods over 366 days, yearly buckets beyond five years, and a server-paginated
   Daily Data table retaining daily detail.
4. Custom dates can also exceed 366 days under the same supported bounds
   and grouping rules.
5. Branch changes preserve the selected period. All time resolves its start for
   the new authorized scope; bounded periods retain their selected dates.

### Backend and contract requirements

Implementation decisions: supported Manila dates are 1900-01-01 through
9999-12-30; analytics emits at most 367 daily, 61 monthly or 8,100 yearly buckets.
Daily pages default to 15 and are capped at 100. Existing explicit-range
responses remain compatible, with optional granularity for grouped periods.
Merchant All time refresh re-resolves earliest activity under current linkage,
retaining the frozen upper bound; this prevents truncated history after relinking.
Period selection is stored in the organization workspace above the branch route,
with user/tenant isolation and role-change clearing. Historical date boundaries
resolve the first valid instant of each Manila date, including skipped midnight.

- Inspect the existing Reports DTOs, service queries, response types, OpenAPI,
  frontend schemas and consumers before choosing exact contract extensions.
- Preserve existing explicit bounded requests. Introduce an explicit all-time
  mode; missing dates must not accidentally trigger unrestricted history reads.
  Reject conflicting modes and unknown fields.
- Resolve earliest activity server-side from both completed sale and refund
  streams within current authorized scope. Never expose another merchant's
  earliest activity date. Return the concrete resolved range.
- Define no-activity behavior explicitly: zero totals, empty collections and
  no-activity metadata without inventing a first-activity date.
- Keep authorization, range resolution and data consistent within each request's
  existing snapshot. Coordinate separate tab requests with the same applied
  bounds so they cannot resolve different reporting periods.
- Extend backend and frontend range validation together. Define a supported
  historical boundary and finite bucket/page sizes before implementation.
  Do not merely remove the limit and return unlimited daily arrays.
- Add grouped analytics and paginated daily reads only as needed, preserving
  existing bounded consumers. Define partial buckets, zero filling and exact
  reconciliation to the applied range.
- Preserve exact monetary/count arithmetic, independent refund dates, ranking
  over the full period, existing role guards and tenant isolation.
- Reuse existing indexes. Measure representative multi-year queries first;
  any index migration requires evidence and review. No new datastore, reporting
  entities, infrastructure or dependencies are planned.

### Implementation sequence after approval

1. Preserve the confirmed user decisions and finalize historical limits,
   API contracts and measurable response/payload acceptance targets here.
2. Add bounded presets using existing Apply and calendar behavior.
3. Extend backend range handling, all-time resolution and bounded long-period
   analytics/daily pagination; update OpenAPI and strict frontend schemas together.
4. Enable long-period presets and All time after their contracts are supported.
   Add resolved labels, chart grouping and daily pagination while preserving
   loading, empty/error/retry, focus and responsive behavior.
5. Validate correctness, privacy and performance; obtain an additional review of
   authorization/privacy changes before completion.
6. Update `docs/modules/reports.md` and affected frontend module documentation;
   archive this plan after acceptance, recording unperformed checks explicitly.

### Acceptance and verification

- Date tests: Manila midnight, month/year boundaries, leap years, month-end
  clamping, inclusive endpoints and agreed rolling-date rules.
- Interaction tests: no fetch before Apply, visible dates match requests, refresh
  retains applied bounds, pagination resets and stale responses stay discarded.
- Data tests: all tabs reconcile, including empty, refund-only, negative-net and
  original-sale-outside-period cases. Grouped buckets and daily pages reconcile
  to exact totals without duplicate rows.
- Security tests: unauthorized roles, foreign tenant/branch IDs, changed access
  and merchant links cannot expose totals or earliest-activity metadata.
- Contract tests: old bounded requests remain valid; conflicting/malformed modes
  fail; all-time no-activity responses are explicit and valid.
- Use disposable PostgreSQL fixtures for multi-year correctness and query-plan/
  timing evidence. Record dataset size, payload size and measured results against
  the agreed targets; unit tests alone do not establish performance.
- Run relevant tests, lint, typecheck/build, formatting and final diff checks.
  Browser-check desktop/mobile, keyboard operation, long labels, grouping,
  pagination and loading/empty/error states.

### Local verification evidence

Commit-time recheck October 20: manual removal of the applied-period summary is
preserved. The focused frontend run passes 244 of 247 tests; three workspace
tests still query the removed `Applied report period` label. This mismatch
remains unresolved rather than restoring the manually removed UI or weakening
the assertions during the commit-only task.

- Backend: 74 focused unit tests, 45 HTTP/OpenAPI tests and 51 disposable
  PostgreSQL integration tests passed; build, focused lint and formatting passed.
- Frontend: 246 tests across 14 Reports and affected workspace suites, typecheck,
  lint and production build passed.
- Independent deep review found three issues (route-level period persistence,
  merchant relink bounds and historical clock transitions); all were fixed and
  the reviewer confirmed no remaining high/medium findings in those changes.
- Disposable fixture: 10,001 sales and sale items plus 2,001 refunds and refund
  items. Targets: each measured endpoint under 2,000 ms and response under
  2,500,000 bytes. Measured endpoints took 4–99 ms; maximum historical-range
  response was 1,370,581 bytes. Of 36 explained queries, the slowest took
  36.001 ms. Existing indexes sufficed; these are local results, not production
  latency guarantees.
- Browser connector reported no available browser; desktop/mobile rendered QA
  was not performed. No production data was modified.
- Whole-backend typecheck has unrelated pre-existing test errors; the Reports
  files and backend production build pass. Preserve this as a separate baseline
  validation gap rather than expanding this implementation into other modules.
  `npx tsc --noEmit --pretty false` reports 25 errors across refresh-cookie,
  inventory, inventory-performance, milestone-access, refund-command and spaces
  test files. No Reports errors remain. The disposable database was removed
  after validation; only local test data was deleted.

### Exclusions and stop condition

The user approved implementation of this plan. Do not change Inventory or Sales
History filters, combine branches, add forecasting, comparison periods, profit
or settlement calculations, scheduled reports, exports, caches or infrastructure.
Do not alter sales/refunds or introduce dependencies without prior discussion.

Stop after the approved period controls and long-history behavior satisfy the
agreed correctness, privacy, performance and UI checks. Any broader work requires
an explicit scope decision.
