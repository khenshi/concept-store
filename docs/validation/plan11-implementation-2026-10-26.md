# Plan 11 implementation record

Date: October 26, 2026

## Implemented application slice

- Promoted Plan 11 to the active implementation plan.
- Added shared route recovery presentation for concise error and not-found
  states, with safe navigation and read retry only.
- Added root-layout, root and protected App Router `error.tsx` and
  `not-found.tsx` surfaces.
- Kept feature-level request errors, checkout/refund outcome recovery and
  authorization behavior unchanged.
- Updated merchant status confirmations to state the restrictions on new sales,
  placements and stock receipts, affected space release, preserved records and
  non-restoration of old space assignments.
- Updated product status confirmations to state selling, placement and stock
  receipt restrictions while preserving branch prices, quantities and movement
  history.
- Confirmed the existing account deletion dialog already satisfies the approved
  current-password, sole-owner, pending, focus-restoration and server-check
  behavior; added the current behavior to module documentation without changing
  its deletion policy.

## Verification performed

- Focused route-recovery, merchant-profile and product-profile tests passed:
  13 tests.
- Full frontend suite passed: 124 test files and 1,218 tests.
- Frontend TypeScript typecheck passed.
- Frontend lint passed with four existing warnings in
  `inventory-placement-form.tsx`; no errors were introduced.
- Changed frontend files passed Prettier checks.
- Frontend production build passed. Next reported the existing multiple-lockfile
  workspace-root warning; it did not block compilation.
- `git diff --check` passed.

## Remaining Plan 11 evidence

The application changes do not by themselves complete the plan. Cross-tenant
and failure-path workflows, 320px/mobile checks, assistive-technology checks,
long or multipage receipt/PDF checks, the report calendar arrow-key behavior,
and the selected pilot browser/device record remain pending. Physical printer
qualification remains deferred until hardware is chosen.

## Follow-up verification — October 27, 2026

- Started the built frontend on a temporary local port and confirmed the public
  page returned HTTP 200.
- Confirmed an unknown public route returned HTTP 404 with the safe `Page not
  found`, unavailable-page explanation and `Back to home` destination.
- Confirmed protected invalid paths exposed only safe recovery copy and no stack
  trace or private exception details.
- A live Chrome session loaded the demo Owner workspace, merchant directory,
  merchant profile, product directory, product profile, account settings, POS,
  sales history and a saved receipt without a runtime error.
- The public unknown-route recovery surface rendered an accessible `Page not
  found` heading, safe explanation and `Back to home` link.
- Merchant and product lifecycle confirmation dialogs rendered their updated,
  action-specific explanations with `Cancel` and confirmation controls. Both
  dialogs were canceled; no status mutation was submitted.
- The account deletion dialog rendered the password requirement and permanent
  deletion warning. It was canceled; no account mutation was submitted.
- The saved receipt rendered receipt metadata, purchased items, payment account,
  reference, total, returnable quantities and recorded refund history.
- The receipt `Print` action opened Chrome's one-page `Save as PDF` preview with
  the receipt content. The preview was canceled without saving; no transaction
  was repeated or changed.
- Accessibility-tree inspection confirmed semantic headings, labels, links,
  controls and dialog focus entering the cancel action. Full keyboard-only,
  320px/mobile, assistive-technology and multi-page PDF checks remain pending.
- Returned to the authenticated receipt page after closing print preview; no
  persistent data was changed during the live checks.

## Follow-up verification — role, empty-state and responsive checks — October 27, 2026

- Manager sign-in loaded the organization workspace with Reports, Inventory,
  Spaces and POS. Reports offered `All branches` within the manager's assigned
  scope; the seeded manager had one assigned branch, and the report loaded its
  zero-data summary and empty chart states.
- Cashier sign-in loaded a reduced workspace with POS and branch/account links;
  Reports was not offered in the navigation. A direct URL attempt redirected to
  sign-in rather than producing an independently verifiable in-app denial, so
  this is not counted as complete route-denial evidence.
- Merchant sign-in loaded Reports, Inventory, Spaces and own historical Sales.
  Reports offered `All branches` across the merchant's authorized own-selling
  branches and rendered the own-sales scope explanation and empty states.
- Product search with a unique nonmatching term rendered `No products match
  these filters` and the recovery hint; clearing the search restored the seeded
  product list.
- Reports showed its loading state while changing the manager period/branch
  scope, followed by a successful empty report state with zero totals and
  explanatory chart text.
- Chrome zoom was raised to 200% on the merchant report page. The workspace
  navigation collapsed into the accessible `Menu` control, headings, filters,
  report tabs and empty-state content remained present, and the zoom was reset
  to 100% afterward.
- The custom report calendar exposed labeled previous/next month controls,
  calendar cells, `Clear dates` and `Apply`. Tab navigation entered the calendar
  and Enter selected a date. The follow-up source fix adds roving day focus with
  Arrow, Home and End navigation, including month-boundary moves; focused
  component tests pass below.
- A 320px viewport, mobile device pass, screen-reader pass, cross-tenant
  authenticated route proof, slow-network/error injection and multipage receipt
  fixture were not available without changing the runtime or adding test data.

## Follow-up fix — shared calendar keyboard navigation — October 27, 2026

- Updated the shared `DateRangePicker` so only the active day is in the tab
  sequence and keyboard navigation moves by day, week, month start or month
  end without changing the pending/apply contract.
- Crossing a month boundary updates the visible month and restores focus to the
  corresponding day after the new calendar cells render.
- Focused tests passed: shared date-range picker and Reports date filter,
  6 tests total.
- Cashier Reports access was not changed: navigation remains hidden, the
  frontend role gate excludes Cashiers, and the backend report routes retain
  their authorization boundary. The direct hard-navigation observation was
  not a clean denial proof because session restoration redirected to sign-in;
  same-origin session-routing verification remains a separate deployment gate.

## Final automated gate run — October 27, 2026

All repository checks below were rerun in disposable Node `20.19.4` containers,
matching `.node-version`. A disposable PostgreSQL 17 database was used for the
backend integration suite and was stopped after verification.

### Backend

- Format check passed.
- ESLint passed with no errors.
- Prisma schema validation and client generation passed.
- TypeScript typecheck passed.
- Unit/service tests passed: 51 suites, 622 tests.
- HTTP/e2e tests passed: 9 suites, 282 tests.
- PostgreSQL integration tests passed: 11 suites, 329 tests; 1 test was
  intentionally skipped by the existing suite.
- Production build passed.
- Built API runtime smoke passed against disposable PostgreSQL: readiness,
  root status and live status returned the expected responses, including the
  no-store readiness header.
- Built frontend same-origin proxy smoke passed: the production frontend served
  successfully and `/api/health/live?ci=1` returned the expected live response
  through the configured proxy.
- Cross-tenant coverage passed through Reports, Products/Inventory, POS,
  Refunds, Spaces and Merchant Branches tests. Foreign organization IDs,
  inaccessible branches and cross-tenant relationships were rejected or
  hidden by the existing authorization/service tests.

### Frontend

- Format check passed.
- ESLint passed with no errors and four pre-existing warnings in
  `inventory-placement-form.tsx`.
- TypeScript typecheck passed.
- Full test suite passed: 125 test files, 1,220 tests.
- Production build passed.
- Shared route-recovery, confirmation, report-calendar and receipt tests were
  included in the passing suite.

### Gate interpretation

- The code, type, build, unit, HTTP/e2e and real-PostgreSQL integration gates
  are complete and green for Plan 11.
- The previously recorded browser checks cover Owner, Manager, Merchant and
  Cashier report-scope/navigation behavior, empty/loading states, 200% zoom,
  route recovery, calendar semantics and one-page saved-receipt PDF output.
- Pilot device/browser qualification is intentionally deferred per the current
  decision. Physical printer qualification remains deferred as already noted.
- Full live two-organization browser/API proof, a controlled 320px viewport,
  screen-reader execution, and a multipage receipt fixture are not proven by
  this local run. They remain explicit follow-up evidence, not claims of test
  success.
- `npm ci` reported dependency audit findings in the disposable installs and
  one development dependency engine warning in each workspace. No dependency
  upgrade or audit remediation was made during this validation-only gate run.
- No product source changes were made during this gate run; this record is the
  only validation update.
