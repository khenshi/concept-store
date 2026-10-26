# Plan 08: Payment Account Management and Reporting

Date: October 22, 2026; source-reviewed and updated October 24, 2026

Status: Completed and archived October 26, 2026. This file records the approved
design, implementation contract and completed acceptance evidence.

Implementation, disposable migration/seed verification, matching deployment and
hosted runtime/browser qualification were completed and confirmed October 26,
2026. The plan is archived after the user-confirmed acceptance gates passed.

Priority: Required before real pilot use. Numbered delivery phases below are
steps, not release-priority exemptions. This filename is retained to preserve
existing links; it does not authorize reconciliation.

This replaces the former reconciliation proposal in this same pending file.
It does not modify or authorize work beyond `../current.md`. Earlier decisions
about shifts, statements, matching and approvals no longer apply to this feature.

## 1. Objective, confirmed scope and exclusions

Owners configure the payment accounts available to each branch. Existing completed
sales and refunds remain the financial source records. Sales Reports shows
Received, Refunded and Net Received by the account actually used.

Confirmed decisions:

- Payment Accounts replaces Payment Methods in user-facing configuration, selections,
  new APIs and relevant models. No separate Payment Method entity or configurable
  method catalog is needed. Cash, GCash, Maya and BPI are individual account choices.
- Owners create, rename, enable/disable and assign custom accounts to one, selected
  or all branches. Branch assignment changes affect future use, not saved records.
- Each organization has exactly one system Cash account. It cannot be deleted,
  disabled, restricted to selected branches or changed into a noncash account.
  It is available in every current and future branch.
- Preserve one account per sale and one actual payout account per refund in MVP.
  Split payments means one sale paid through multiple accounts; it is deferred.
- Received and Refunded use donuts. Net Received can use a donut when all amounts
  are nonnegative, but switches to a signed bar chart if any account is negative.
  An accompanying table always shows all three amounts accurately.
- Managers retain account breakdowns for their assigned branches; Owners retain
  tenant-wide authorized branch access. Merchant/Cashier reporting is not widened.
- Owners configure whether each custom noncash account requires a reference.
- Confirmed October 24: Owner-only Payment Accounts entry in the organization
  sidebar; custom accounts default to requiring a reference, editable for future
  transactions only; fixed Cash label and unique normalized custom names per tenant.
- The system is developmental: use a verified development reset and fresh dataset
  instead of preserving existing development GCash/Card records. Planning remains
  non-destructive; section 8 defines the later reset safeguards.

Out of scope: reconciliation sessions, drawer/cashier shifts, cash counts, statement
entry/CSV import, matching, discrepancies, approval, bank feeds, opening balances,
expenses, transfers, provider fee accounting, settlements/payouts, general ledger,
multi-currency and partially paid sales. Do not implement those former foundations.
Inventory stock reconciliation is unrelated and remains unchanged.

Reporting disclaimer: these figures are recorded transaction flows for the selected
period and branches, not verified bank/wallet balances or guaranteed available cash.
They exclude opening balances, transfers, withdrawals, expenses, provider fees and
settlement timing. A completed manual POS payment is not provider-verified.

## 2. Current architecture and specific weaknesses

Inspected source and implemented module documentation:

| Area                                                                         | Current implementation                                                                                                                                          | Planned impact                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `backend/prisma/schema.prisma`: Sale, Refund, SalePaymentMethod              | Each source stores CASH/GCASH/CARD enum, total, reference and completedAt; Sale also stores cash tender/change. No standalone Payment or payment-account model. | Add account configuration and account linkage/snapshots to existing sources. Do not create duplicate transaction rows.             |
| `sales/checkout.service.ts`, `sales/dto/checkout.dto.ts`                     | Enum-dependent conditional validation, precise server totals, atomic stock writes, canonical checkoutCommand and request-ID replay.                             | Replace new-command enum with account ID, derive cash/reference behavior from server configuration; preserve saved command replay. |
| `refunds/refunds.service.ts`, create-refund DTO                              | Actual payout method may differ from original sale; partial item returns and precise totals are already supported.                                              | Store the actual refund account independently of the original sale account; keep quantity/restock limits.                          |
| `sales/sales.types.ts`, sales/refund read services and list DTOs             | Explicit staff versus merchant projections; enum-dependent filters.                                                                                             | Add staff account identity/snapshot and account ID filters; preserve merchant exclusions and cashier restrictions.                 |
| `reports/reports.service.ts`, `reports/sales-analytics.ts`                   | Gross sale/payment and actual refund-method aggregates. Existing netByPaymentMethod subtracts refunds grouped by the ORIGINAL sale method.                      | New account net must subtract ACTUAL refund-account outflows. Reusing original-method net would produce wrong account totals.      |
| Frontend `pos/model/checkout.ts`, checkout/refund APIs, sales/refund schemas | Fixed enum whitelist and response-versus-command checks. Pending/unknown command recovery is intentionally strict.                                              | Update runtime schemas, drafts, fingerprints, receipts and recovery together, not just labels.                                     |
| `reports/model/report.schemas.ts`, `staff-analytics-dashboard.tsx`           | Fixed three-row arrays, hard-coded labels/colors and PaymentMethodDonut.                                                                                        | Dynamic account arrays, exact invariants, metric toggle and signed-net chart.                                                      |
| `docs/modules/{pos,sales,refunds,reports}.md`                                | Existing money, tenant scope, replay, access and read-only reporting contracts. No implemented Finance or Settlement module.                                    | Update implemented docs only when each approved implementation phase ships.                                                        |

Paths in the table are relative to
`backend/src/modules/organizations/` or `frontend/src/features/` where applicable.

SQL payment CHECK constraints in the sales/refund persistence migrations also
depend on the enum. Replacing TypeScript fields alone would break inserts.
Historical references are reusable, manually entered and not unique or verified.
The old enum cannot identify multiple wallets/bank accounts retrospectively.

Existing reports are branch-scoped. Preserve their branch/date selection and
Asia/Manila calendar conversion to UTC half-open intervals. An account shared
across branches must not accidentally return its other branches' totals.

October 24 review reconfirmed fixed enums and three-element response arrays,
original-sale-method net attribution in `sales-analytics.ts`, and serializable
checkout with saved canonical command comparison. Reviewed schema/migration
constraints, checkout DTO/service, refund schema/service, report service/schema,
staff analytics UI, OrganizationsModule and relevant module documentation.
No new application tests, build, database, provider or browser checks ran for this
planning update. Earlier tests elsewhere are not evidence this feature exists.

## 3. Smallest architecture

```text
Owner Payment Account configuration
         | branch availability
         v
POS checkout / manual refund
         |
         v
Existing Sale / Refund + immutable account identity snapshots
         |
         v
Existing Sales Reports: grouped account flows
```

Backend: `organizations/payment-accounts/` with a focused controller, DTOs,
PaymentAccountsService and a small availability check reusable inside existing
checkout/refund transactions. Register through existing OrganizationsModule
conventions. No broad Finance framework, separate datastore or generic ledger.

Frontend: `features/payment-accounts/{api,model,components}/` plus the existing
POS, Sales, Refunds and Reports features. Owner-only management route:
`/app/organizations/:org/payment-accounts`, linked as Payment Accounts in the
organization sidebar. A new Finance dashboard is unnecessary.

Account configuration is authoritative for NEW selections. Historical receipt
snapshots are authoritative for what a saved transaction displayed. Reports group
stable account IDs, not display names. Do not hard-code payment choices in clients.

## 4. Data model

### PaymentAccount

- UUID ID and organizationId; restrictive organization relation.
- Name/display label, enabled boolean and assignmentMode ALL or SELECTED.
- Immutable nullable systemKey: CASH for the organization's single system Cash;
  null for owner-created accounts. Enforce tenant/system-key uniqueness.
- Minimal account behavior: owner-configurable requiresReference for custom accounts
  (default true; later edits affect future transactions only). Cash behavior follows systemKey,
  not its label. Do not create a second method entity or infer behavior from names.
- Version and normal created/updated timestamps for configuration concurrency.
- Optional bounded description/display order only if the management UI needs them;
  no bank credentials, account balance, provider integration or payment secrets.
- Cash constraints: enabled=true, assignmentMode=ALL, requiresReference=false;
  immutable system identity and fixed Cash label.
- Enforce unique trimmed/case-insensitive names per organization, including the
  reserved Cash name. Distinct accounts such as GCash Main and GCash Backup are
  allowed. Never merge accounts with equal or similar names.
- No hard-delete endpoint in MVP; disable custom accounts to preserve references.
  This is a simpler stronger rule than allowing deletion only for unused accounts.

### PaymentAccountBranch

Composite organization/account/branch link for SELECTED mode. Tenant-safe FKs
prove both account and branch belong to the same organization; unique account /
branch membership. ALL is a dynamic mode, not a materialized list: future branches
automatically become eligible. SELECTED requires at least one valid branch.
ALL mode has no selected rows; changing mode and replacing assignments is atomic.

A shared account is one stable organization account with multiple branch uses,
not one copy per branch. Transactions retain their original branch. Historical
use does not depend on the account's current assignment links.

### Existing Sale and Refund additions

Add to each existing record:

- paymentAccountId with a restrictive composite FK to the same organization account.
- paymentAccountName snapshot and bounded behavior snapshots needed for cash /
  reference validation and historical presentation.
- Keep existing total, completedAt, paymentReference and Sale cashTender/cashChange.
  Amounts continue to live on Sale/Refund; there is no new PaymentAmount or ledger.
- Account identity and snapshots are fixed at completion. Renaming, disabling or
  reassigning accounts must never update old source rows.
- Refund account is independently selected and validated for the processing branch.
  It may differ from the original sale account; multiple partial refunds can use
  different accounts while retaining cumulative item-quantity limits.

Use an immutable cash-behavior snapshot in source-row CHECKs so cross-table mutable
configuration does not control old data validity. Server writes verify it against
the selected account. Cash Sale: tender >= total, exact change=tender-total, no
reference. Noncash Sale: no tender/change, reference according to saved policy.
Cash Refund: no tender/change/reference; noncash Refund retains applicable
reference policy. Keep totals positive/finite and exact Decimal types.

Configuration snapshots are not another source of selectable payment options.
The fresh-development schema and public API replace method fields with account
fields directly; do not retain two competing configurations for disposable data.

Indexes: account tenant/name lookup, account/branch links, and measured
Sale/Refund organization/branch/account/completedAt query patterns. Use PostgreSQL
numeric sums with safe widened intermediate capacity; JSON money is exact
two-decimal strings. No floating-point amount arithmetic.

## 5. Account management and availability workflow

1. Organization creation atomically provisions Cash. Migration provisions one Cash
   per organization in the replacement dataset idempotently, including those with no sales.
   Demo/test seeds follow the same invariant. Cash availability is not dependent on
   a later maintenance job.
   With Plan 07, creation means protected operator provisioning, not restored public
   tenant creation. Integrate Cash creation in that transaction/service seam.
2. Owner creates an account, configures applicable reference behavior, enabled state
   and ALL or selected branches. Validate branch IDs and name uniqueness server-side.
3. Edit supports rename, enable/disable and assignment changes with a version check.
   Show which changes affect future transactions and that historical amounts remain.
   Save is disabled for invalid/unchanged drafts.
4. POS/refund selectors request accounts for the authorized active branch and
   operation. Show only enabled, assigned accounts. Cash always remains available.
   Clear a stale selection after access/config refresh; do not auto-submit checkout.
5. A new command sends paymentAccountId and the applicable tender/reference.
   Backend derives scope, behavior and snapshots, recomputes totals and validates
   availability inside the same transaction as the sale/refund and stock mutation.
6. Account mutation and new completion coordinate with a consistent account-row
   locking/version protocol. If completion commits first, disabling applies to
   subsequent commands; if disabling/unassignment wins, reject the new command
   atomically. A cached dropdown is not authorization.
7. Identical completed command replay returns its immutable saved result even when
   the account was subsequently renamed/disabled/unassigned, after fresh user and
   branch authorization. Do not require CURRENT account usability for that replay.
   Conflicting request-ID content remains a safe 409.
8. New refunds can only use currently enabled/assigned accounts, even if the sale's
   original account is now unavailable. Staff explicitly select another actual
   payout account; original history is unchanged.

Distinguish command selectors from historical filters: a disabled/unassigned
account must disappear from new payment choices, but remain selectable as a
historical filter when it has authorized branch activity. Mark it Historical /
Disabled / No longer assigned rather than hiding valid saved records.

## 6. Proposed API changes and RBAC

```text
GET    /organizations/:org/payment-accounts
POST   /organizations/:org/payment-accounts
PATCH  /organizations/:org/payment-accounts/:account
GET    /organizations/:org/branches/:branch/payment-accounts?operation=SALE|REFUND
```

Organization list/create/update are Owner-only. Account update includes enabled,
name, reference policy and assignmentMode/branch IDs as one versioned command;
avoid separate endpoints that leave an account partially assigned.
No DELETE route. Return only safe config data; never private financial credentials.

Branch availability checks both current user access and intended operation:
OWNER across tenant branches; MANAGER assigned branches; CASHIER assigned-branch
SALE only; MERCHANT no POS/refund command account selection. Refund permission
remains Owner/Manager-only. Do not add roles or a generic permission engine.

Existing checkout/refund POSTs replace paymentMethod with paymentAccountId for
new account-aware commands. Keep paymentReference as a transaction reference;
that name is not a method configuration and need not be renamed.

Sales/POS/refund history filters migrate from paymentMethod to paymentAccountId;
validate foreign IDs and history visibility without applying current availability
to past transactions. Return snapshot labels in saved staff details/receipts.
Merchant own-item views must still omit whole-sale payment/account information.

Extend existing Sales Reports analytics response with dynamic paymentAccounts:
accountId, displayName, current enabled/assignment status as appropriate, received,
refunded and netReceived. Coordinate a single account-aware API/client contract
cutover for the approved empty-development dataset. No temporary dual enum/account
representation is required just to preserve disposable clients. Reject stale
method-based writes. A version marker for frozen commands is distinct from
maintaining two payment configurations; agree it with 18 before implementing.
Never sum old and new response representations.

Owners and assigned-branch Managers can read the account breakdown. Preserve
existing Merchant/Cashier restrictions; do not widen their financial projections.
No organization-wide shared-account total is returned from a branch-scoped route.

## 7. Sales Reports: calculations and design

For each account A in authorized branches B and applied interval [from, until):

```text
Received(A)     = SUM(Sale.total WHERE paymentAccountId=A and branch in B
                      and Sale.completedAt >= from and < until)
Refunded(A)     = SUM(Refund.total WHERE paymentAccountId=A and branch in B
                      and Refund.completedAt >= from and < until)
Net Received(A) = Received(A) - Refunded(A)
```

- Successful means the existing completed Sale record, not an online provider status.
- Cash received uses Sale.total, not tender (which includes returned change).
- Refunds are attributed to Refund.paymentAccountId on refund completion date,
  including refunds of sales outside the selected sale-date interval.
- Never group account refunds through the original Sale's account. Example: a 1,000
  GCash sale refunded 200 in Cash yields GCash received/net 1,000 and Cash refunded
  200/net -200. Total net across accounts is 800.
- Aggregate Sales and Refunds independently before joining their account totals.
  Joining sale items/refunds/accounts directly can multiply totals.
- Current enabled/assignment filters must not remove historical source activity.
  Include every currently applicable configured account (including zero rows), plus
  disabled/unassigned accounts that contributed historical activity in scope.
  For an Owner all-account view, zero-valued disabled accounts can be explicitly
  included through a display filter; totals never depend on that filter.
- Group shared accounts once by ID. Branch-scoped reports only include that branch;
  when Plan 09 adds the approved authorized multi-branch selector, use distinct
  branch IDs and include each Sale/Refund once. Plan 09 owns that selector and
  scope-resolution contract; this plan must support it without duplicating routes
  or introducing another branch preference. Both are required before pilot launch.
- Sums across all account rows reconcile exactly to scoped gross/refund/net totals.
  A renamed account stays one account row, using its current label for discovery;
  source details keep original snapshot names. Disabled/historical badges explain
  why an account no longer appears in POS.

Presentation: replace the fixed payment-method donut with Payment Accounts.
Add a segmented Received / Refunded / Net Received toggle, default Received.
Metric changes use the same fetched account data and do not refetch the page.
Use stable account-ID-based colors, dynamic legends and exact accessible values;
do not assume three accounts or use label-based array indexes.

Received/Refunded donut includes nonnegative amounts and an honest zero-data state.
Net Received uses the same donut only if all account values are nonnegative and
their sum is positive. If any account is negative, show a signed bar chart with
zero baseline and exact totals; never take absolute values, drop negative rows or
show misleading percentages. All-zero net has an explicit zero state.

Always show a simple breakdown table: Account | Received | Refunded | Net Received,
including zero/historical rows as defined above, plus exact total footer.
Net text uses green/zero graphite/red with signs and accessible labels, not color
alone. Keep shared table pagination default 15 if the account list exceeds a page;
chart and footer totals cover all rows, not just the visible page. Dynamic account
volume must be bounded explicitly in the contract, not silently truncated.

The data remains read-only and does not claim actual account balance. Preserve
existing report period presets, All Time bounds, source date behavior and branch
access. No changes to rankings, merchant item ownership or payout calculation.

## 8. Development reset and coordinated cutover

The user confirmed this is a development system and permits replacing development
data with a fresh dataset. Do not build legacy GCash/Card mapping, historical
backfill or a legacy replay-only endpoint solely to preserve disposable fixtures.
This supersedes the earlier expand/backfill/legacy-compatibility proposal.

No database reset is performed during this planning task. During approved
implementation:

1. Resolve the exact development database/schema from the running API and migration
   configuration; verify they target the same intended environment without exposing
   credentials. Stop if production/shared non-disposable data or an unexpected target
   is found. Development permission is not permission to reset another environment.
2. Agree on the replacement fixture coverage and any desired backup/export before
   destruction. Explain that the reset removes existing development transactions
   and configuration; preserve repository migrations and unrelated code changes.
3. Stop/drain payment writers and prevent old clients from posting. Resolve or
   explicitly abandon disposable pending/unknown checkout and refund attempts.
   Reset invalidates their records/request IDs; do not replay stale commands into
   the fresh dataset. Require client reload/sign-in and clearing stale attempt state.
4. Add a forward migration with account tables, account-aware Sale/Refund FKs and
   required snapshots, row checks and indexes. Remove enum-only constraints and
   obsolete method fields/types in the new schema/API together. Do not rewrite
   already-authored migration history just to make a reset easier.
5. Apply the full migration chain to an isolated disposable test database first.
   Where a forward migration cannot safely transform arbitrary existing data,
   enforce an explicit empty-development-dataset precondition and fail clearly.
   This is not a production-ready historical data migration.
6. Reset/reseed only the verified authorized development target through the
   repository's supported workflow. Provision exactly one always-enabled/all-branch
   Cash per organization; seed explicit configurable accounts and branch assignments,
   not legacy method categories disguised as real account identities.
7. Seed deterministic examples for shared/selected accounts, enabled/disabled
   accounts, configurable reference requirements, renamed historical snapshots,
   partial/different-account refunds and a negative net period. Verify expected totals.
8. Deploy/restart matching API/frontend versions together and regenerate Prisma and
   route/schema artifacts as required. Reject obsolete method-based commands before
   any writes, rather than inventing enum values for new accounts.
9. Verify the application target/schema, Cash invariant, account availability,
   stock/sale/refund consistency, all report totals and fresh command replay.

After cutover, successful new command replay must still survive account rename,
disable or branch reassignment with fresh user/branch authorization. Keep canonical
command identity and immutable response snapshots; no permanent legacy payment
configuration is needed. New production or non-disposable deployment would require
a separately approved preservation/backfill strategy before applying destructive
changes. A database reset is not a runtime account-management feature.

## 9. Split payments, partial refunds and important cases

- **Split payments:** deferred by user decision. One Sale.total belongs to exactly
  one account in MVP, so an unsupported multi-account payload is rejected.
  Later add authoritative payment legs only through a separately approved feature:
  sum of leg amounts equals sale total, cash change applies to the cash leg, reference
  belongs to each applicable leg, reports sum legs instead of whole Sale.total.
  Do not report both source totals and payment legs. Account configuration stays
  unchanged; receipt/replay/contracts require explicit versioned migration.
- **Partial refunds:** retain current partial/full item-return model and original
  saved prices; aggregate each completed Refund.total to its actual payout account.
  Never subtract an original full sale amount for a partial return. One Refund uses
  one account in MVP; separate refund operations can use different enabled accounts.
- **Partially paid sales:** still unsupported; tender must cover total. No receivable
  balance, pending-sale state or invented overpayment/refund behavior.
- **Disabled/reassigned/renamed account:** new use rejected where unavailable; history
  and reports retain ID/labels/amounts. Completed authorized replay succeeds unchanged.
- **Duplicate references:** retain current nonunique references; account configuration
  does not turn them into transaction identities or provider verification.
- **New branches:** ALL accounts automatically usable; SELECTED accounts require Owner
  assignment. Cash must exist and be usable before first checkout.
- **Deleted user/merchant/branch:** preserve restrictive source history and existing
  visibility semantics; no cascade deletion of account-linked financial records.
- **Reference-policy changes:** apply to future completions only, using snapshots;
  existing commands/history stay stable. Pending drafts require revalidation, not
  silent mutation of uncertain commands.
- **Large amounts/account count/concurrency:** exact sums, bounded responses, stable
  order and transactional writes; no N+1 query per account or hidden limit on totals.

## 10. Frontend and management UX

Owner page: Payment Accounts header; Create Account action; search/status/branch
filters; table of Name, Availability, Branch assignment and Actions.
Cash is clearly System / All branches with disable/reassign/delete unavailable.
Custom accounts offer Edit and Enable/Disable; branch assignment uses existing
custom multi-select patterns and an explicit All branches option. New account
drafts must choose branch mode; do not silently enable every branch.

Use existing OperationalCollection/Table, gray filter surfaces, custom SelectControl,
FormDialog/ModalActionRow, branch picker patterns, skeletons and FloatingNotice.
No new UI/dependency system. Pending saves lock only the relevant operation; scoped
errors and retry preserve drafts. Refresh selectors when branch/account availability
changes, but leave frozen pending/unknown checkout/refund commands intact.

UI/API terminology: Payment account, Account reference, Received, Refunded,
Net Received. Keep Cash tender and Change as behavioral fields; they are not
method entities. Use actual account label in receipt, sales/refund details and
history. Historical filter labels must explain inactive/unassigned options.
Do not expose staff whole-payment account details in merchant-reduced views.

## 11. Delivery phases and dependencies

1. **Approve contracts/policies:** settle section 13, finish reference inventory,
   schema/constraint/migration design, role projection and verified reset/cutover.
   Promote an explicitly approved bounded phase into current.md; this pending file
   is not build authority.
2. **Account registry:** account/branch schema and fresh-data Cash provisioning,
   Owner management APIs/UI, transactional availability and concurrency tests.
3. **Account-aware sources and selections:** source FKs/snapshots, command/read
   contracts, POS/refund/sales selections/history/receipt updates and recovery parity.
   Account configuration must be ready before enabling custom account writes.
4. **Account reporting:** independent grouped aggregates, dynamic schemas,
   Received/Refunded/Net toggle, signed chart and exact breakdown table. Remove
   original-sale-method net reuse and prove all scoped totals match existing Reports.
5. **Development cutover and hardening:** disposable migration/reset rehearsal,
   verified target reset/reseed, stale attempt invalidation, new command replay,
   all-tenant Cash checks and coordinated API/frontend rollout. Remove public
   method terminology, obsolete contracts and fixed arrays.
6. **Final verification/docs:** focused/full regression, performance and browser
   QA; update implemented module docs and archive approved completed phases.

No database write is performed during planning. The user permits a later verified
development reset with replacement data, not a production reset. No new
infrastructure/dependency is authorized. Do not replace current.md during this task.

## 12. Testing and acceptance

- Schema/unit: one Cash per tenant including concurrent provisioning, immutable Cash
  invariants, ALL versus selected branch rules, name normalization, same-tenant FKs,
  behavior snapshots, exact totals, reference/cash combinations and unchanged saves.
- HTTP/RBAC: Owner config only; Manager/Cashier authorized branch SALE options;
  Owner/Manager refund options; Merchant denial of payment configuration and full
  account totals; foreign branch/account IDs return safe not-found; strict unknown-
  field rejection and no client-supplied cash flags/totals/snapshot overrides.
- Source/race tests: disable/unassign/reference-policy edit versus checkout/refund;
  a command either commits entirely with valid snapshots or rejects without stock
  effects. Replay after rename/disable/unassignment remains correct and reauthorized.
  Preserve request-ID content conflicts and pending/unknown recovery locks.
- Reports: Cash versus tender, multiple accounts with identical provider labels,
  shared accounts across two branches, independent sale/refund dates, partial and
  multiple refunds, refund through another account, negative/zero/refund-only
  periods, disabled/unassigned historical activity, rename grouping by ID and exact
  equality of account sums to report gross/refunded/net totals.
- Migration/reset: full migration chain on an empty disposable database, seed
  repeatability, Cash for every organization, replacement fixture totals, tenant
  isolation, exact-target safeguards and rejection of obsolete commands. Verify
  stale pre-reset attempts cannot create new payments. Preserve post-cutover
  replay and history after account changes; no production compatibility is claimed.
- Frontend: dynamic account lists (not fixed length three), stale option clearing,
  branch availability, invalid/unchanged saves, report toggle without refetch,
  signed-net fallback, accessible exact table, zero states and stable colors/IDs.
  Existing report filters, receipt printing and merchant privacy regressions pass.
- Verification: Prisma validate/generate and migration checks, lint, typecheck,
  targeted API/unit/integration tests, relevant full suites and production builds.
  Measure actual grouping queries with representative account/transaction volumes.
  Browser desktop/mobile, keyboard/focus, modal calendar/dropdown overflow and
  200% zoom require recorded real QA under 11/14; a waiver records missing evidence
  and is not equivalent to passing launch acceptance.
- Completion means account configuration is the ONLY source for new choices,
  enabled/assignment rules are enforced server-side, snapshots/history are stable,
  recorded per-account flows are exact, current POS/refund/replay rules are preserved,
  and old payment-method terminology/configuration is removed from active contracts.

Planning verification preceded implementation. Implementation and acceptance
evidence are recorded in `docs/validation/plan08-implementation-2026-10-25.md`.

## 13. Confirmed implementation decisions

Confirmed: one account per sale/refund now, Cash always enabled/all branches,
signed bars for negative net, assigned-branch Manager access, Owner-configurable
reference requirements and a fresh development dataset. October 24 confirmations
and remaining gates:

1. **Confirmed management location:** Owner-only Payment Accounts entry in the
   organization sidebar.
2. **Confirmed reference policy:** default required for custom accounts; Owners
   may edit it later for future transactions only, preserving snapshots.
   Required references use existing 2–100-character
   validation; optional absent references must be valid without blank placeholders.
   If an optional reference is supplied, validate it with the same bounded format.
3. **Reset dataset:** confirm the exact development target at implementation time
   and choose example accounts/branches/transactions and any desired backup before
   reset. No historical GCash/Card backfill is needed for the disposable dataset.
4. **Confirmed names:** fixed Cash label; unique normalized custom names per
   tenant. Multiple GCash/BPI accounts use distinct labels and stable account IDs.
5. **Zero-row scope/volume implementation choice:** show currently assigned
   accounts plus every account with historical activity. Disabled zero-only
   accounts remain available in Owner management. Return complete grouped totals;
   paginate rendered table rows at 15 and never truncate financial aggregates.

These decisions affect usability/compatibility, not authority to restore any
removed reconciliation workflow.

## 14. Cross-plan contracts, security and rollout gates

- **03/07:** verification, current membership/session and tenant activation apply
  to every configuration, availability and reporting path. Inactive organizations
  retain authorized historical reads, not new configuration/payment writes. Cash
  being always available does not override tenant/branch/role restrictions.
- **04/06:** use approved target validation, migration provenance, disposable tests
  and controlled release ordering. The account schema change must not accidentally
  break operator activation or token migrations from earlier plans. An explicitly
  empty-dataset-only migration fails on nonempty data: never run the demo reset to
  make a live release pass. Stop for a preservation plan if real records exist.
- **09:** resolve authorized branch IDs once per report request. Account aggregate,
  table totals and overall totals share a consistent database snapshot and date
  interval. Never resolve scope from current account assignment alone. Manager
  responses omit assignment details and zero-account identities from inaccessible
  branches; current relevant accounts plus in-scope historical activity suffice.
  Merchant responses remain own-item-only and never acquire whole-account totals.
- **16/18:** completed-command lookup requires fresh authorization but not current
  account availability. Distinguish returning an existing saved result from creating
  a new write during deactivation. A retry with no saved outcome must satisfy
  current account/tenant/branch rules; never mutate a frozen command to a replacement
  account or automatically submit it. Define lock order across account, branch,
  sale/refund and inventory rows and bounded serialization/deadlock retry behavior.
- **17:** reuse branch multi-select UI without implementing unrelated directory
  pagination. Paginate management tables at 15 rows; charts and report totals must
  represent all in-scope accounts, not just that management page.
- **19:** optional exports consume the same account ID/snapshot and exact decimal
  contracts. Export work is not required to ship this feature.

### Maintainable reporting bounds

Prefer a complete grouped result for the organization's small operational account
set, with bounded label lengths, pagination of rendered table rows and measured
response/query budgets under 12. No arbitrary first-N query limit that loses money.
If realistic volume cannot satisfy the budget, agree a bounded complete aggregate/
legend contract before implementation rather than silently merging accounts into
Other or requesting one query per account. Show zero currently applicable accounts
and all historically contributing accounts by default; disabled zero-only accounts
are discoverable through Owner management, not hidden amounts in financial totals.
This conservative display rule is recorded in the approved current scope.

### Rollout and rollback

Rehearse the complete migration chain, fresh Cash provisioning and known fixture
totals before the separately authorized exact-target development cutover. Drain
writers and coordinate browser reload/schema/command version changes. Do not allow
an old client or saved development command to create a transaction in the new
dataset. Verify newly completed commands remain replayable after account edits.

After any non-disposable account-aware transaction exists, rollback must preserve
its account FK, snapshot, command and money records. Do not revert to an enum-only
writer, drop account columns or reset financial data as rollback. Retain a compatible
application/configuration or roll forward under 04/06; real database disaster
recovery uses the tested 15-minute RPO / 2-hour RTO, not a code-deployment shortcut.

Completion evidence includes the deep security/financial/concurrency review,
API/client contract parity, Cash/tenant constraints, independently computed
fixture totals, representative-volume queries, replay/race tests, and hosted
browser/runtime acceptance. Implemented module documentation is current in
POS, Sales, Refunds, Reports, Organizations, Runtime Operations and
`docs/modules/payment-accounts.md`.
