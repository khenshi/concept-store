# Spaces workspace validation — October 10, 2026

## Scope

Dedicated organization/branch Spaces routes and navigation, role-scoped branch
selection, reuse of existing management/history, dirty-form and pending-write
branch-switch protection, and server-side occupied/vacant list filtering. No new
schema, migration, dependency, or production operation was introduced.

## Local checks

| Check                                       | Result                                              |
| ------------------------------------------- | --------------------------------------------------- |
| Frontend TypeScript                         | Passed                                              |
| Frontend ESLint                             | Passed                                              |
| Frontend production build                   | Passed; both new routes emitted                     |
| Focused frontend regression suite           | 108 passed across nine files                        |
| Final full frontend suite                   | 903 passed; six existing failures across four files |
| Backend ESLint and build                    | Passed                                              |
| Backend unit suite                          | 466 passed across 38 suites                         |
| Spaces PostgreSQL/HTTP integration suite    | 23 passed                                           |
| Changed-file formatting and diff whitespace | Passed                                              |

The focused suite covers spaces API/schema/management, new workspace entry and
branch access, navigation, workspace shell, shared branch selection, branch
workflows, and merchant profiles. New checks cover server filter serialization,
merchant filter visibility, dirty draft cancellation, pending saves, direct URL
precedence, inaccessible branches, remembered branch fallback, retries, cashier
request suppression, and active-route boundaries. Shared branch-selection tests
now include Spaces alongside POS, Inventory, and Reports.

Database tests ran against a newly started disposable PostgreSQL 17 container,
`concept-store-access-part4-postgres`, on localhost port 58882, database
`concept_store_test`. The suite applies repository migrations into a random test
schema and drops that schema afterward. Added cases prove filtering before
pagination/count, closed-history vacancy, archived spaces, combined merchant/type/
status filters, unchanged defaults, invalid/unknown input, merchant/cashier denial,
manager branch restrictions, and foreign-tenant isolation. Existing occupancy
concurrency, lifecycle-release, history, authorization, and constraint tests pass.
No application or production database was used.

Initial sandbox database connections failed with EPERM; the integration suite
passed with authorized local access. The first frontend build could not fetch
Google Fonts inside the sandbox; the authorized network-enabled rerun passed.
The existing multiple-lockfile workspace-root warning remains.

## Existing full-suite failures

These match the baseline recorded in
[previous spaces validation](spaces-2026-10-09.md#existing-frontend-failures):

- Inventory movement records: two Philippine-date label expectations.
- Merchant analytics dashboard: one sorting-label expectation.
- Staff analytics dashboard: two summary/ranking expectations.
- Sales workflows: one receipt-search accessible-name expectation.

No failing full-suite test belongs to the Spaces workspace change. Existing React
`act` warnings also remain in unrelated workflow tests.

## Outstanding acceptance and rollout

Browser QA was attempted through the available computer-use browser entry point;
it returned **No browser is available**. Desktop/mobile visual inspection, actual
keyboard/focus behavior, and interactive browser assignment/release checks remain
unverified. DOM interaction tests and the production build do not replace them.
The current plan remains open for that acceptance check rather than being archived
as fully verified.

Existing branch/merchant-affiliation/space migrations and matching production
API/frontend deployment remain pending under their prior rollout requirements.
This change neither applies nor resolves them. Apply the existing required schema
before deploying the API/frontend; no additional workspace migration is needed.
