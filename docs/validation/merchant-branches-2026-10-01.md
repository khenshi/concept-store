# Merchant branch implementation validation — October 1, 2026

## Delivered

Schema/migration, inherited access, association APIs, active participation checks,
owner management, frontend workflows, response validation/OpenAPI, and module
contracts are implemented. Spaces and other exclusions remain excluded. Existing
unrelated branch-directory work was preserved. No dependencies were added.

## Checks

| Check | Result |
| --- | --- |
| Prisma format, validation, client generation | Pass |
| Migrated PostgreSQL / Prisma schema diff | Empty, pass |
| Backend format, lint, TypeScript / production build | Pass |
| Backend unit suites | 466 passed |
| Backend HTTP suites | 224 passed |
| PostgreSQL suites | 262 passed; 1 opt-in performance test skipped |
| Frontend TypeScript, lint, production build | Pass |
| Focused frontend workflows | 184 passed |
| Full frontend suite | 867 passed, 6 baseline failures |
| Frontend formatting | One unchanged baseline file fails; changed files formatted |
| Git diff whitespace check | Pass |

The six frontend failures reproduce in a separate copy of the workspace as it
existed before this implementation, with the same tests and assertions:

- Inventory movement records: two tests expecting the older `From (PH)` label.
- Merchant analytics: one test expecting `Sorted by Gross sales`.
- Staff analytics: two tests expecting prior summary/ranking labels.
- Sales workflows: one test expecting the older `Search receipt code` label.

The unchanged `staff-analytics-dashboard.spec.tsx` also has a baseline Prettier
failure. These unrelated expectations/style changes were not modified.

PostgreSQL validation uses randomly named isolated schemas on a disposable local
PostgreSQL instance. The migration fixture verifies zero-stock inclusion, grant
and placement deduplication, staff preservation, merchant invitation revocation,
unchanged inventory/prices/thresholds/movement records and transaction snapshots.
It reports 2 associations created, 2 linked grants converted, 2 merchant grants
removed, 1 invitation revoked, and 1 inventory row backfilled. These are fixture
counts, not production counts. Tests also verify actual placement, receiving and
checkout waits during concurrent deactivation and no resulting writes, completed
command replay, independent branch balances, and refunds restocking the original
placement after deactivation.

## Browser checks

Local API port 3030 and built frontend port 3002 used the disposable demo database.
Existing application processes/databases were not replaced. Safari desktop and
Chrome verified profile affiliation lists and native assignment dialogs. Chrome
verified keyboard traversal, Escape focus restoration, confirmed deactivation,
reactivation affordance, inactive inventory reads and disabled receiving while
correction controls remained available. At verified 200% browser zoom the layout
reflowed to compact navigation. At 400 × 693 device emulation, profile controls,
association filters and assignment dialog remained within the viewport and the
dialog's content/actions remained reachable. These are bounded checks, not a full
mobile-device or every-role end-to-end certification.

## Rollout status

The migration was exercised only on disposable local data. Production deployment
and production write-pause checks have not been performed. No deployment target
or production maintenance window was provided. Before live rollout:

1. Back up the production database and capture stock/history/access snapshots.
2. Pause all application writers; deploy migration and matching backend/frontend.
3. Capture migration NOTICE counts and compare stock, money, movements, sales and
   refunds against pre-migration snapshots. Verify converted access and staff grants.
4. Reopen writes after checks pass. Never run the old application against converted
   merchant access. A committed data-conversion rollback requires the backup and
   matching prior application version.

See [Merchant–branch relationships](../modules/merchant-branches.md) for contracts.
