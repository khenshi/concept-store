# Plan 16: Branch lifecycle enforcement

Date: October 24, 2026

Status: Draft for review; planning only. No status, permission, schema, service,
frontend or database behavior changed during this task.

Priority: Required before real pilot use, confirmed October 24.

## 1. Goal and confirmed policy

Make existing Branch ACTIVE/INACTIVE status enforce new-operation restrictions
while preserving authorized history and controlled closure. Own the branch
lifecycle addition in the [deployment checklist](../../deployment-readiness-checklist.md)
and [planning queue](README.md), without inventing another branch state model.

Confirmed October 24:

- Only Owners activate/deactivate branches. Assigned Managers retain ordinary
  branch-detail editing, not lifecycle status changes.
- Inactive branches allow authorized Owners/assigned Managers to refund existing
  sales, correct existing stock, release occupied spaces and deactivate merchant
  participation. They cannot create sales, receive stock or make new assignments.
- Enforcement is required before the real pilot starts.

Existing action-specific permissions still apply: this policy cannot grant a
Manager an Owner-only participation operation. Cashiers/Merchants do not gain
refund, correction, release or configuration rights. Tenant inactivity under 07
is stricter: branch closure exceptions do not authorize writes to an inactive
organization. Deactivation is not deletion, stock transfer or settlement.

Excluded: branch deletion, new global maintenance mode, cascading merchant/product
status changes, inventory transfers, automatic space release, billing or generalized
permission/audit infrastructure. No new branch entity/status or dependency required.

## 2. Current source evidence

Reviewed BranchesService/controller/DTOs and module docs; checkout authorization,
stock transaction seam, product initial-stock path, merchant participation lock
helper, space mutation inventory and recorded module review decisions.

- Branch docs explicitly say status is reversible metadata and does not affect
  POS/inventory/sales. BranchesService.updateStatus writes the label after scope
  lookup; controller currently allows Owner and Manager.
- Checkout authorizes current membership and accessible branch but does not
  reject inactive branches. Existing serializable completion/replay must survive.
- Inventory/space/merchant-participation operations have their own transaction
  seams; a controller-only status check cannot close races or alternate entry paths.
- Product creation can place initial stock directly; only checking Inventory
  placement routes would leave a bypass.
- `requireActiveParticipation` uses tenant-scoped share locks in sorted merchant
  order before inventory locks. Branch lifecycle must integrate with this order,
  not introduce a conflicting late branch lock and deadlocks.
- No application tests, database, browser or race checks ran for this draft.
  Current module docs remain accurate for the implemented label-only behavior.

## 3. Operation matrix

| Operation                                                                          | ACTIVE branch                         | INACTIVE branch                                                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Authorized detail, inventory/movements, sales/refunds/receipts, occupancy, Reports | Existing scoped reads                 | Preserve same authorized historical reads; status is not a blanket scope filter.                     |
| New checkout                                                                       | Existing eligibility                  | Block, including stale open carts and direct API calls.                                              |
| New placement/initial stock or receiving stock                                     | Existing eligibility                  | Block across Inventory and Product initial-inventory paths.                                          |
| New space creation/assignment or new/reactivated merchant participation            | Existing eligibility                  | Block new branch operations/assignments. Existing organization-wide types remain separate.           |
| Refund saved sale, optional original-placement restock                             | Existing eligibility                  | Allow existing Owner/Manager permissions and refund limits; validate actual payout account under 08. |
| Correct existing inventory quantity                                                | Existing eligibility                  | Allow existing authorized correction workflow/reason, not stock receipt disguised as correction.     |
| Release current occupancy / deactivate existing participation                      | Existing eligibility                  | Allow existing action-specific roles and constraints; no automatic lifecycle cascade.                |
| Ordinary branch name/address editing                                               | Existing Owner/assigned Manager rules | Retain those rules, including current validation/uniqueness.                                         |
| Activate/deactivate branch                                                         | Owner only after implementation       | Owner only; reactivation does not restore any removed relationship.                                  |

Other branch writes (price/threshold edits, existing space edits/archive, account
assignment and staff access configuration) need explicit classification before
coding. Proposed conservative default: block branch-local operational edits not
listed as closure, but allow Owner access/security administration and assignment
removal without enabling new branch operations. Do not infer approval from an
HTTP verb or introduce a Manager participation permission. Resolve these remaining
details in the approved implementation phase; avoid a blanket mutation guard.

Correction semantics remain existing adjustment rules, not a new accounting
feature. Review whether positive quantity corrections require extra explanation;
do not ban legitimate corrections or permit stock intake to bypass the receipt
restriction without an explicit business decision. Historical read access still
requires current membership/branch/merchant authorization.

## 4. Backend enforcement and concurrency

Reuse Branch.status and scoped lookups. Add a narrow branch-operation assertion
or lock helper at the existing service transaction layer, not a global permission
framework. Every checked branch includes organizationId. Foreign/missing or
unassigned objects retain existing safe not-found behavior; disclose inactive
status only after authorization. A permitted actor's blocked new operation returns
a stable typed conflict (proposed `BRANCH_INACTIVE`) with no partial side effects.

Status transition must recheck current Owner membership at the business boundary,
not rely solely on a hidden button/controller role. Reject caller-selected role,
organization and unknown DTO fields. Ordinary detail PATCH cannot change status.
Keep the existing status endpoint and add an explicit expected-prior-state/version
check if needed to reject stale conflicting Owner dialogs; do not introduce broad
versioning for unrelated models. Same-state requests can return the unchanged
authorized state without duplicate effects.

Coordinate transition and new writes with a common scoped branch-row protocol:
branch before merchant participation before inventory/source/space rows, with
stable ordering for multi-branch lifecycle actions. Inspect every existing write
path, including merchant deactivation that releases spaces across branches, before
finalizing lock order. Shared branch lock for operations/exclusive status change
is a candidate; prove installed Prisma/PostgreSQL behavior and existing isolation
compatibility before committing the implementation. Status check outside the
transaction is never sufficient.

Define the linearization: if a valid operation acquires the governing branch lock
first, it may commit before deactivation; if deactivation wins, new operations
reject. Do not promise instant cancellation of already-committing sales. Roll back
all money/stock/placement/occupancy writes on rejection. Retry serialization errors
only within bounded existing command/idempotency rules; no new request ID.

### Saved outcomes versus new writes

Find an already-completed identical command after fresh actor/tenant/branch/source
authorization, then return its saved outcome even if branch is now inactive. Do
not require present sellability/account availability to re-read a completed sale.
A changed command with same ID still conflicts. If no saved outcome exists, a new
write must satisfy the matrix and current account/price/stock/return rules.

18 owns durable command storage/lookup; 10 owns unresolved escalation. Missing
lookup does not prove no commit; never clear an uncertain attempt or mint another
sale because lifecycle changed. Tenant inactivity still blocks new refunds and
corrections even though branch inactivity alone allows controlled closure.

## 5. Frontend behavior and API contracts

Preserve directory pagination/search/status filters and existing single-branch
URLs. Hide Owner status actions from Managers and reject them on the backend.
Owner confirmation explains blocked new work, permitted closure/history and no
automatic stock/assignment deletion. Reactivation restores branch eligibility
only; merchant/product/participation/account conditions remain authoritative.

Show a concise inactive notice in affected workspaces and disable unavailable
new-operation actions with a reason. Do not hide historical routes or replace
current branch preference with another branch automatically. Clear stale loading/
request state on scope changes; never discard 18's frozen unknown commands.
Recover stale open forms with typed server feedback and safe refresh, not automatic
submission after reactivation or silent cart/account mutation.

Reuse shared confirmation/dialog/notice primitives. Where identity-only branch
DTOs omit status, add only authorized minimal status/operation-availability fields
to the relevant staff contract, OpenAPI and runtime schemas together. Do not widen
Merchant address/actor/account projections just to show a status banner. Read-only
Reports All Branches still includes authorized inactive historical activity.

## 6. Integration and migration boundaries

- 07's tenant status/verification and current membership precede branch eligibility.
- 08 validates accounts for closure refunds; Cash always available cannot override
  tenant or actor restrictions. Account branch reassignment never rewrites history.
- 09 retains historical scope; 11 tests closure/error/accessibility flows; 12 load/
  races; 14 now requires this plan before pilot.
- 17 staff assignment/access history and 20 space-type/privacy behavior remain
  separate. Do not automatically remove members/affiliations when deactivating.

No data migration or branch-status backfill is presumed necessary. Existing labels
gain enforcement after deployment; inventory all inactive branches and warn Owners
before cutover. Do not silently reactivate branches to avoid blocking old workflows.
Any necessary version/index schema change follows 04/06 with explicit approval.

## 7. Delivery and verification

1. Finalize remaining operation classifications and lock order; inventory every
   branch write/alternate entry path. Capture current permissions and replay tests.
2. Implement Owner-only transition, narrow transaction enforcement and unchanged
   historical reads, with colocated tests and typed API/schema parity.
3. Add frontend lifecycle guidance/action states without redesign or data hiding.
4. Test unit/HTTP: all roles, assigned/unassigned/foreign branch, direct detail/status
   bypass, inactive organization versus inactive branch, allowed closure and blocked
   checkout/receive/placement/assignment, initial-product stock and stale forms.
5. On verified disposable PostgreSQL, race status changes against checkout, refunds,
   stock correction/receipt, assignment/release, participation changes and identical
   replay. Assert one ordered result, no partial writes and preserved history.
   Include multi-branch merchant lifecycle operations to catch deadlocks/order bugs.
6. Run formatting/lint, app/test-source typing, relevant full unit/HTTP/integration,
   Prisma checks if changed and builds. 11 owns real browser keyboard/dialog/notice
   checks; deep review required for financial/concurrency/security implementation.
7. Update branches and affected POS/inventory/product/refund/space/participation/
   reporting module docs only after actual delivery. 06 controlled release and 14
   pilot sign-off consume evidence, not this draft.

Rollback to label-only code would re-enable blocked writes and is not a safe
unreviewed rollback. Prefer compatible fix/forward recovery or explicitly pause
affected operations under 10; never change data/statuses to conceal a failure.
Preserve financial commands/history and operator decisions through release changes.

## 8. Completion and open gates

Complete when Owner-only status transitions and the approved operation matrix are
enforced atomically across all entry points, controlled closure/history work with
fresh authorization and command recovery remains safe. Required before pilot.

Remaining gates: explicit rules for unlisted edits/configuration, stale-transition
conflict contract, exact lock order and measured race/deadlock proof. No new state
model, automatic closure cascade or broadened Manager privilege is approved.
