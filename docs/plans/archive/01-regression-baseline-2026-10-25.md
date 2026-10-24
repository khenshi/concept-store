# Plan 01: Regression baseline and test-contract recovery

Date: October 23, 2026

Status: Completed October 25, 2026 after explicit implementation approval.
Source/local gates and 72 affected disposable-PostgreSQL tests passed, including
the opt-in benchmark. See [dated results](../../validation/regression-baseline-2026-10-25.md)
for commands, counts, warnings and limits. No automatic approval of Plan 02.

Priority: P0 engineering gate before real pilot transactions. This plan repairs
the local regression baseline; it does not certify deployment readiness.

## 1. Goal, ownership and exclusions

Restore trustworthy automated checks for the existing implemented system before
building the remaining launch features. Classify each failure against its actual
contract, fix obsolete tests or genuine regressions at the responsible layer, and
keep authorization, validation and monetary assertions intact.

Owns the failing-check item in checklist §3 and all failure triage in §4 of the
[deployment checklist](../../deployment-readiness-checklist.md). See the
[sequence](../pending/README.md) for the other workstreams.

Included:

- Six currently failing frontend unit/component assertions.
- Two default-pagination assertions in inventory HTTP boundary tests.
- All currently reproduced backend test-source TypeScript diagnostics.
- Targeted regression proof, full local gate reruns and a dated results record.
- Narrow documentation corrections when an implemented contract is clarified.
- Approved October 23 default alignment: initialize the inventory placement
  form's low-stock threshold to 5 instead of 0. Test omitted/default submission
  and explicit 0 opt-out; do not modify existing stored thresholds, API defaults,
  low-stock derivation or other numeric validation. This is an approved narrow
  behavior change, not merely an assertion update.

Excluded:

- Startup/logging/readiness fixes (02), auth/proxy/password-policy changes (03),
  database operations and migration changes (04), hosting (05) and CI setup (06).
- Payment Accounts, All Branches, other features and broad UI refactors.
- New schemas, entities, APIs, response formats, dependencies or infrastructure.
- Application database access/reset/seed, deployment or production data changes.
- Financial algorithm changes, authorization-policy changes and test-suite rewrites.
  If needed to resolve a failure, stop that item for a bounded revised plan/deep
  review instead of disguising the change as test maintenance.

## 2. Architecture and evidence

Read the relevant current-behavior references before implementation:
[POS](../../modules/pos.md), [frontend experience](../../modules/frontend-experience.md),
[branches](../../modules/branches.md), [inventory](../../modules/branch-inventory.md),
[reports](../../modules/reports.md), [spaces](../../modules/spaces.md) and
[authentication](../../modules/authentication-and-accounts.md).

Tests live beside frontend source and backend unit source; backend HTTP and real
PostgreSQL suites live in `backend/test/`. Existing Vitest/Testing Library and
Jest/ts-jest/Supertest are sufficient. Reuse them; do not add a new test framework.

Observed weaknesses:

- Some component assertions couple behavior to removed copy, DOM ancestry or
  Tailwind geometry. Updating these blindly could hide a real regression.
- `backend/tsconfig.build.json` deliberately excludes tests. A passing Nest build
  is not proof that the full test-source TypeScript program compiles.
- The observed Jest runs pass through ts-jest without proving that full program
  is type-safe. Keep a separate full `tsc` gate; do not weaken strictness/exclusions.
- Direct service tests do not receive DTO defaults/transformation automatically.
  Their fixtures must model actual validated requests deliberately.
- Branch hints differ between current source and its documented/tested contract.
  The user confirmed the hint-free design; update the test/docs, not the UI.

### Fresh checks during drafting

Run on October 23, 2026 against the local worktree; no application DB contacted.

| Check                                                                            | Result                                  | Limits                                                                           |
| -------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| Six named frontend test files, command in §6                                     | 71 passed, 6 failed; 77 total           | Focused selection, not the entire frontend suite                                 |
| `npm run test:e2e -- --runInBand test/products-inventory.e2e-spec.ts` in backend | 111 passed, 2 failed; 113 total         | Real HTTP test application with mocked services/Prisma, not database integration |
| `npx tsc --noEmit --incremental false` in backend                                | 25 diagnostics across 6 test/spec files | Full compiler failed; no fixes made                                              |

The October 22 checklist's full-suite counts remain historical. Full units,
frontend suite, builds, lint, Prisma validation and database/browser tests were
not rerun to draft this plan. Reproduce again at implementation start because
the worktree is shared and already contains unrelated edits.

## 3. Frontend recovery matrix

Paths below are relative to `frontend/src/`.

| Area / failing test                                               | Evidence and intended resolution                                                                                                                                                                          | Required proof                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/pos/model/pos-cart.spec.ts`                             | Assertion expects `Only 1`; `pos-cart.ts` throws `max quantity for Amihan Vase`. Preserve current copy unless separately changed; align the assertion only after proving rejection behavior.              | Zero/unavailable stock, adding above stock and changed-price rejection remain covered; failed addition does not mutate the cart; exact integer/decimal totals remain unchanged.                                                                                             |
| `shared/components/ui/text-field.spec.tsx`                        | `compactFieldError` now returns `Enter a valid price.` rather than the old PHP/decimal sentence. Keep the full validation detail, not just a generic error assertion.                                     | Compact message visible, full message retained in the described-by target, `aria-invalid` set, and existing label/hint/external described-by IDs preserved for both supported error positions. Automated DOM checks do not certify a real screen reader.                    |
| `features/branches/components/branch-workflows.spec.tsx`          | Test/doc require concise hints; `branch-form.tsx` supplies empty hint strings. User confirmed keeping the hint-free design: update those expectations and the module documentation; do not restore hints. | Add disabled with missing required values and enabled with complete valid data; normalization/live validation, cancel/pending protections, labels and error descriptions preserved. No validation changes merely to satisfy hint text.                                      |
| `features/inventory/components/inventory-placement-form.spec.tsx` | Enter selection already passes the input-value assertion. Failure is the subsequent missing `/Selected:/` text, not evidence of a broken Enter handler. Avoid reintroducing redundant UI only for a test. | Select with Enter, submit valid branch settings, and assert the exact selected `productId` reaches `createPlacement` with the intended scope. Editing search clears stale selection; preserve existing debounce, later-page keyboard, stale-response and conflict coverage. |
| `features/reports/components/daily-data-tab.spec.tsx`             | Merchant assertion expects `PHP -7.00`; current display removes the currency prefix. Align with the implemented table formatting without changing report amounts.                                         | Merchant-only columns/data retained, positive/zero/negative signs and presentation correct, no prohibited staff columns, no `PHP` in the refined amount cells. Do not touch aggregation or money arithmetic.                                                                |
| `features/spaces/components/space-management.spec.tsx`            | Inline type flow fails on an ancestor `md:col-span-2` assertion; actual ancestor is `min-w-0`. Prefer stable semantic/behavior checks over brittle DOM ancestry.                                          | Continue through create/save/select flow, preserving space draft, chosen type, pending/retry and access behavior. Where layout classes are intentional contracts, assert on the actual owning element; leave rendered layout certification to 11.                           |

For the picker, prove selection through the saved payload rather than relying only
on displayed text: a selected-looking label could otherwise hide a stale ID.
Keep the backend eligible-product scope authoritative. Do not widen candidate
reads to every organization product or trust a client merchant/branch identity.

## 4. Backend recovery matrix

### A. Inventory HTTP defaults

`backend/test/products-inventory.e2e-spec.ts` currently expects default 10 for
movement records and 50 for placement movement history. Both corresponding DTOs
now default to 15:

- `src/modules/organizations/inventory/dto/list-movement-records-query.dto.ts`
- `src/modules/organizations/inventory/dto/movement-history-query.dto.ts`

Update only omitted-limit expectations to 15. Keep explicit `limit=10` assertions
at 10 and preserve bounded limit/cursor/date validation and the trusted caller
context forwarded by the guards. Check both defaults separately; do not alter API
defaults to match stale assertions. Preserve 400/401/403/404 and cross-merchant tests.

### B. Full test-source type safety

Paths below are relative to `backend/`. The counts describe the drafting snapshot,
not a permanent diagnostic budget.

| File                                                                   | Observed issues                                                                                                                                    | Planned correction                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/auth/sessions/refresh-cookie.service.spec.ts`             | 1 incomplete object-to-Express Request assertion                                                                                                   | Model the request boundary with a typed fixture containing what the service reads; any unavoidable partial boundary cast must remain local, not weaken production request types. Preserve cookie extraction/clearing tests.                                                             |
| `src/modules/organizations/inventory/branch-inventory.service.spec.ts` | 9: four obsolete input `merchantId` properties, two duplicate expected-data keys, one stock-status enum mismatch, two missing query `limit` values | Remove client merchant input from valid DTO fixtures while keeping the derived merchant in expected persisted data. Remove duplicate keys without losing assertions. Use the actual `InventoryStockStatus` enum, and initialize DTO/query defaults explicitly for direct service calls. |
| `test/inventory-pos-performance.integration-spec.ts`                   | 1 stock-status enum mismatch                                                                                                                       | Use the exported inventory enum, keeping the same low-stock filter and performance scenario. It is not a Prisma-generated enum.                                                                                                                                                         |
| `test/milestone-1-access.e2e-spec.ts`                                  | 4 overly narrow inferred mock role-return errors                                                                                                   | Give the mocked membership lookup an accurate role/null result type so all existing role-denial cases compile. Never delete the Manager/Merchant/Cashier authorization matrix or change guard behavior.                                                                                 |
| `test/refund-command.integration-spec.ts`                              | 1 obsolete `reason` field on a receive-stock request                                                                                               | Align the receipt fixture to the actual ReceiveInventoryDto, distinguishing it from the correction DTO. Preserve the competing receipt/correction/refund quantity and ledger assertions.                                                                                                |
| `test/spaces.integration-spec.ts`                                      | 7 helper arguments inferred as UUID template types; 2 unchecked OpenAPI schema-union property reads                                                | Type the human-readable space-name helper parameter as `string`. Narrow `SchemaObject` versus `ReferenceObject` before property checks, with a failing assertion for an unexpected reference. Preserve absent timestamp fields and occupancy race/history scenarios.                    |

Do not use global `any`, `@ts-ignore`, relaxed compiler flags, widened production
DTOs, disabled diagnostics or skipped tests as the solution. A typed mock must
still represent the fields used by authorization. Negative invalid-input tests
must remain deliberate and clearly separated from valid fixtures.

No schema/API contract changes are expected. No runtime source edits are expected
except a confirmed narrow regression; justify any
such edit against the owning module and rerun its neighboring tests.

## 5. Implementation phases and stop gates

Additional approved contract repair from the October 23 module review:
`MerchantBranchPageResponseDto` in
`backend/src/modules/organizations/merchant-branches/merchant-branches.controller.ts`
declares `limit` as enum `[10]`, while the service and frontend require 15.
Correct OpenAPI to 15 and add a focused generated-schema regression assertion.
Keep runtime defaults, scope, pagination and business rules unchanged. Run the
assertion in the existing suitable test harness; any real-DB test still requires
the disposable-target gate below. This is planned work, not an implemented fix.

1. **Capture baseline:** record commit plus dirty-worktree context, environment
   versions and exact commands. Rerun focused failures and full backend typecheck;
   record new/disappeared diagnostics instead of assuming this snapshot is exact.
2. **Confirm contracts:** apply the confirmed hint-free decision in §9. Preserve intentional
   user-authored UI refinements. Separate stale assertion, fixture typing and
   genuine production regression in a small failure ledger.
3. **Repair focused frontend cases:** make minimal per-area changes and run each
   affected suite. Add missing behavioral proof before removing fragile assertions.
4. **Repair backend tests/fixtures:** correct HTTP defaults, then typed fixtures,
   enum imports and schema narrowing. Run affected unit/HTTP suites and full tsc.
   Obtain deep review if an authorization/financial/concurrency invariant changes.
5. **Run the complete local matrix in §6:** resolve introduced failures. Record
   unrelated failures without silently declaring the overall gate green. After
   two unsuccessful targeted fixes or unexpected complexity, reassess/escalate.
6. **Exercise DB-backed fixtures safely:** schedule affected integration suites
   only on an independently verified disposable target using the existing harness.
   If no such target is approved/available, record this as pending evidence rather
   than connecting to the application DB. Plan 04 owns provisioning/recovery rules.
7. **Review and hand off:** inspect the complete task diff, record results/limits,
   update only affected module docs and the checklist evidence. No deployment or
   automatic transition to Plan 02 implementation.

This plan depends only on existing tools; the branch-hint decision is confirmed.
It supplies reproducible gate commands to 06; it does not implement CI. Real DB
execution may await 04 without blocking source/fixture repair, but unrun fixture
tests remain an explicit completion/release gate, not a fabricated pass.

## 6. Verification commands and evidence

Run commands from their named package directory. Use installed dependencies; do
not fetch/upgrade packages or run destructive seed/reset commands for this work.

Frontend focused reproduction:

```sh
npm test -- --run src/features/pos/model/pos-cart.spec.ts src/shared/components/ui/text-field.spec.tsx src/features/branches/components/branch-workflows.spec.tsx src/features/inventory/components/inventory-placement-form.spec.tsx src/features/reports/components/daily-data-tab.spec.tsx src/features/spaces/components/space-management.spec.tsx
```

Frontend final gates:

```sh
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

Backend focused gates:

```sh
npm test -- --runInBand src/modules/auth/sessions/refresh-cookie.service.spec.ts src/modules/organizations/inventory/branch-inventory.service.spec.ts
npm run test:e2e -- --runInBand test/products-inventory.e2e-spec.ts test/milestone-1-access.e2e-spec.ts
npx tsc --noEmit --incremental false
```

Backend final gates:

```sh
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx tsc --noEmit --incremental false
npm run lint
npm run build
npm run prisma:validate
```

After independently confirming `TEST_DATABASE_URL` is an approved disposable
database, run the affected real-DB suites through the existing harness:

```sh
npm run test:integration -- test/inventory-pos-performance.integration-spec.ts test/refund-command.integration-spec.ts test/spaces.integration-spec.ts
```

These suites create schemas, apply migration SQL and perform writes/cleanup.
Setting a variable is not proof of a safe target. Never substitute `DATABASE_URL`,
use the demo reset, or point them at a store database. Inspect their setup/cleanup
before execution; do not claim mocked HTTP success establishes DB behavior.

Run installed Prettier against changed supported files only, and `git diff --check`.
Record full-repository formatting debt separately rather than mass-reformatting.
Build warnings about lockfile roots belong to 06/15 unless they actually block
this gate. Do not ignore newly introduced warnings or errors.

For every check record date, command, result/count, environment, revision/worktree
context and any unavailable evidence. Never overwrite old results as if tests ran
against the same code. Browser/device/printer/deployed qualification remains in 11/14.

## 7. Safety, compatibility and rollback

- Tenant/branch checks, cashier denials, merchant own-data projections and foreign
  object not-found behavior must retain their existing assertions.
- Keep precise amount/sign, quantity, idempotency, rollback and refund/stock race
  scenarios. Test repairs cannot relax an invariant to fit current output.
- Existing invalid/unknown DTO-field rejection remains authoritative. Removing an
  obsolete field from a valid fixture does not mean accepting it at the HTTP API.
- No migration or data rollback is involved. Revert only this task's known edits
  if necessary; do not reset/check out the dirty worktree or discard user changes.
- If a production authorization, money or concurrency defect is exposed, preserve
  the reproducer and request an explicitly bounded correction/deep review before
  extending the implementation beyond this plan.

## 8. Acceptance and documentation handoff

- All six focused frontend cases and both inventory HTTP defaults pass for the
  intended behavior; picker selection is also proven by the submitted ID/scope.
- Full backend tsc reports zero errors without weakening strictness or excluding
  tests. Full frontend/backend local suites, lint/typechecks/builds and schema
  validation have recorded successful results for the implementation snapshot.
- Affected integration fixture changes have actual disposable-DB execution evidence
  or remain explicitly pending; the plan cannot be called fully verified without it.
- Every assertion removed/replaced has equivalent or stronger contract coverage.
- No unrelated UI/features, dependencies, schemas, APIs or financial rules changed.
- Update relevant module docs only where implemented behavior was restored or
  clarified, especially the branch-hint decision; do not document proposed behavior
  as shipped. Record dated verification in the deployment checklist without checking
  any hosting/security/browser/restore boxes this plan did not exercise.
- Review task diff, remaining risks and unavailable checks before archival. Archive
  only completed scope; this planning document is not implementation evidence.

## 9. Decisions and risks

**Confirmed decision — branch hints (October 23, 2026):** keep inputs without
hints and update documentation/tests. Remove outdated hint-copy expectations;
retain required-field disabling, valid submission, labels and error associations.
Do not restore hint text or change validation. No outstanding business-policy
decision is required for this plan; any new material ambiguity found during
implementation must still be raised rather than assumed.

Primary risks are accepting output instead of a contract, removing coverage after
an early failed assertion, typed mocks that misrepresent access contexts, changed
worktree baselines, and treating source fixes as DB/browser/deployed proof. The
phases and evidence gates above address these without adding architecture.
