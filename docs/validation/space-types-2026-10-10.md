# Organization space types validation — October 10, 2026

## Implemented scope

Organization-wide SpaceType catalog, Spaces/Types workspace tabs for staff,
owner-only creation, catalog dropdowns for space creation/edit and filtering,
and inline type creation that preserves the space draft. Existing space string
contracts, branch access, occupancy history, and unrelated work remain intact.

## Automated evidence

| Check                                                  | Result                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Prisma format, validation, client generation           | Passed                                                             |
| Backend lint and build                                 | Passed                                                             |
| Backend unit tests                                     | 466 passed across 38 suites                                        |
| PostgreSQL migration and spaces HTTP/integration tests | 27 passed across two suites                                        |
| Frontend lint and TypeScript                           | Passed                                                             |
| Frontend production build                              | Passed                                                             |
| Focused frontend workflow regressions                  | 114 passed across nine files                                       |
| Final tab-keyboard refinement                          | All 34 spaces tests passed, including the additional keyboard test |
| Full frontend suite before that final keyboard test    | 909 passed; six known baseline failures                            |
| Changed-file formatting and diff whitespace            | Passed                                                             |

Database tests used only disposable PostgreSQL 17, container
`concept-store-access-part4-postgres`, localhost port 59195, database
`concept_store_test`. Random integration schemas were removed after tests.
A separate populated-schema migration test applies the old migrations first,
creates active/archived case-variant spaces and real occupancy, then applies the
new migration. It proves canonicalization, separate tenant catalogs, unchanged
space count/status and occupancy records, legacy string inserts/updates,
case-insensitive uniqueness, failed-write rollback, and schema rollback without
losing spaces or occupancy. Service/HTTP checks cover owner-only writes, current
membership reload, invalid/unknown bodies, merchant own-used-type projection,
shared manager reads, unused/foreign type exclusion for merchants, referenced-type
FK protection, and concurrent duplicate type creation. Existing occupancy and
lifecycle integration tests continue passing.

Frontend tests cover tab access, owner creation, manager read-only catalog,
merchant tab exclusion, dirty draft cancellation, keyboard tab focus, catalog
choices, inline creation with name preservation and auto-selection, API scope
validation, pending-submit protection, and recoverable duplicate errors. Existing
navigation, shared branch-selection, branch, and merchant-profile regressions pass.

Full-suite failures match the previously documented baseline: two inventory
movement date-label expectations, one merchant analytics sorting label, two staff
analytics summary/ranking expectations, and one sales receipt-search name.
No failing test is in the Spaces/Types change. Existing unrelated React act
warnings remain. No package or lockfile changes were needed.

## Browser evidence

The browser connector had no attached browsers. Native Safari control provided
an alternative. A copied frontend under `/private/tmp/concept-space-types-ui`
ran on port 3301 with webpack, targeting an isolated API on port 3300 and the
same disposable database. All migrations were applied only to this disposable
public schema, with synthetic owner/organization/branch fixtures.

Verified in Safari:

- Desktop Spaces layout, tabs, catalog filter, and existing rows/actions.
- Creating Shelf from Types and seeing it in the organization catalog.
- Opening Add space, keeping the Display A name while creating Display inline,
  automatically selecting Display, and successfully saving the space.
- Filtering by the new Display choice and seeing only the matching space.
- Spaces and Types at a 390 by 844 responsive viewport, with stacked controls
  and no visible horizontal clipping.
- Signing out of the synthetic test session, closing its tab, and returning to
  the original development tab. The test login used localhost, whose auth cookie
  is shared across ports; the original development app may require sign-in again.

The original development app was not migrated or used for test writes. Its Types
view showed an Internal server error before the migration was applied there;
the same feature worked against the migrated disposable database. Do not claim
that the original app/database or production deployment is ready based on this QA.
Temporary API/frontend processes and the disposable container were stopped.
Broader manager/merchant browser checks and assignment/release browser workflows
from the prior workspace plan remain open; automated checks cover these rules.

## Deployment and rollback

Apply `20261010010000_add_space_types` after the existing prerequisite migrations,
then deploy the matching API/frontend. The migration is transactional and briefly
locks Space writes while backfilling and installing its trigger/FK. Existing labels
are deduplicated case-insensitively with deterministic canonical spelling; existing
identities and occupancy are preserved. Old API clients keep string contracts and
the registration trigger supports those writes during application rollback.

For separately authorized schema rollback, remove the Space catalog FK, then
Space_register_type trigger, register_space_type function, and SpaceType table.
Retain Space.type and occupancy tables. Original capitalization requires a backup
if exact spelling restoration matters; the verified rollback retains canonical
labels. No live migration, provider deployment, or production rollback was run.
