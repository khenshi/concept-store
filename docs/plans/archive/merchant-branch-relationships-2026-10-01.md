# Current Plan: Explicit merchant–branch relationships

Approved October 1, 2026. Deliver backend and frontend; exclude future space assignments, transfers, rental agreements, new roles and merchant write permissions.

## Approved behavior

- Add tenant-safe MerchantBranch (id, organizationId, merchantId, branchId, ACTIVE/INACTIVE status, timestamps), unique organization/merchant/branch, restrictive foreign keys and listing indexes.
- Add backend-derived merchantId to BranchInventory with scoped Product and MerchantBranch foreign keys; retain independent branch inventory, sales, movements and refunds.
- Backfill ACTIVE associations from all placements and linked MERCHANT user grants, deduplicate, backfill inventory ownership, remove converted merchant grants. Revoke pending merchant invitations and preserve staff invitations and history. Emit migration counts and verify stock/history unchanged with writes paused.
- Owner-only idempotent PUT merchant/branch association and PATCH status; paginated ten-row GET merchant branches and branch merchants with search/status. Managers read assigned branch affiliations; merchants read own affiliations. Tenant/role checks, strict DTOs, OpenAPI contracts.
- All merchant-linked users inherit every association, including inactive associations for reads. Staff keep individual grants. Managers see affiliated merchants and their products even before placement.
- ACTIVE affiliation required inside coordinated transactions for placement/opening stock, receiving and POS checkout. Inactive blocks these operations with MERCHANT_BRANCH_INACTIVE; corrections, price/threshold edits, refunds and history remain. Completed command replay returns original results.
- Merchant grants reject mutations; merchant invitations inherit profile affiliations and reject nonempty branchIds. Preserve historical own-sales/report access. Directory counts ACTIVE associations, labeled Active merchants.
- Merchant profile Branches and branch detail Merchants sections: owner assignment/status controls, read-only role projections, pagination, existing operational surfaces and dialogs. Update member/invitation access explanations, inventory candidates, inactive receiving/POS feedback and stale-state refresh.
- Validate schema, migration, isolation, role rules, concurrency, idempotency, independent stock/history and frontend flows using unit/HTTP/PostgreSQL/frontend suites, lint/typecheck/build and bounded desktop/mobile keyboard/focus/zoom checks.
- Deploy migration and app together with writes paused. Document implemented contracts under docs/modules; archive this plan after completion.

## Completion

Implementation completed October 1, 2026. See [validation record](../../validation/merchant-branches-2026-10-01.md) for check results and baseline failures. Production rollout remains an operational follow-up; only disposable local databases were migrated.
