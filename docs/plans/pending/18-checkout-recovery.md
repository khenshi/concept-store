# Plan 18: Durable checkout and refund outcome recovery

Date: October 24, 2026

Status: Draft for review; planning only. No command, schema, API, browser state,
financial record or database operation changed during this task.

Priority: Required before real checkout/refund use and Plan 14 pilot approval.

## 1. Goal and confirmed decisions

Recover the original frozen checkout/refund command after reload, tab closure or
device change without repeating money collection/payout or stock effects. Own the
durable outcome-recovery requirements in the
[deployment checklist](../../deployment-readiness-checklist.md) and [queue](README.md).

Confirmed October 24:

- Same authenticated staff member can recover across devices, with fresh access.
- Block a new command of the same kind for that actor/organization until the
  original is safely resolved. Checkout and refund are separate namespaces.
- Completed entries leave the recovery list only after explicit acknowledgement;
  sale/refund history remains unchanged and retained under approved policy.

Only explicit deliberate submission/retry may write. Reopening, mounting, signing
in, regaining connection, timers and background refresh only read status. No
offline POS, general cart-draft persistence, payment-provider verification,
duplicate ledger, staff impersonation or automatic refund/charge/restock.

03/07 own identity/verification/tenant activation; 08 account-aware commands;
04/06 migrations/releases; 10 operator escalation/restore; 11 recovery UI/browser;
12 concurrency/security; 13 retention/privacy; 16 branch lifecycle. No new
infrastructure, queue or dependency required by default.

## 2. Current evidence and weaknesses

Reviewed frontend checkout/refund attempt stores and API result validators,
CheckoutService canonical/original/replay paths, RefundsService canonical/replay
and sale-lock paths, Prisma source metadata and queue requirements.

- Attempt stores are in-memory Maps keyed organization/user. They cannot survive
  full reload or another device. Original frozen command can therefore be lost.
- Sale and Refund already persist canonical command, actor and organization-scoped
  request ID. Replay checks actor/branch/exact command; refund additionally checks
  original sale. They are the authoritative outcomes, not browser flags.
- Completion services use serializable transactions and existing stock/return
  constraints. Preserve those invariants rather than another financial pipeline.
- Client strict parsing and result-versus-command checks can reject a response
  after the server committed. Such errors must remain unknown, not safe-to-restart.
- Current contracts still use fixed methods; 08 migrates them to accounts. Freeze
  the approved account-aware version, never translate uncertain commands silently.
- No new application tests, database, cross-device/browser or concurrency checks
  ran for this draft. Durable recovery is not implemented by existing replay alone.

## 3. Minimal architecture and persistence

Cross-device support requires a small PostgreSQL recovery envelope persisted before
the first financial submission. This is command coordination, not another Payment,
Sale/Refund ledger or stored balance. Reuse existing source records/outcome reads.

Proposed focused record:

- ID, organizationId, actorUserId, kind CHECKOUT/REFUND, requestId, branchId and
  refund saleId where applicable; tenant-safe relations and immutable scope.
- Frozen canonical command JSON and explicit schema/version; bounded input
  payload contains only fields required to validate/retry the command. No passwords,
  session/action tokens, bank secrets, full catalog/cart cache or duplicated receipt.
  Necessary references/reason are private transaction data, never log payloads.
- Minimal lifecycle timestamps/state: prepared, submitted/uncertain, completed,
  acknowledged, and safely closed-without-write where provable. Final state names
  are technical design details, not permission to drop unknown commands.
- Optional stable source outcome ID derived from the same Sale/Refund transaction;
  no duplicated mutable money totals. Server response always revalidates outcome.
- Unique organization/kind/request ID and at most one blocking envelope per
  organization/actor/kind enforced in PostgreSQL, e.g. a reviewed partial unique
  index. Scope never depends on a device ID, tab flag or caller-selected actor.

Completed but unacknowledged envelopes remain blocking. Other actors and the other
kind remain independent; this is not a global branch lock or stock reservation.
No user-controlled editing of frozen payload after preparation. An idempotent
prepare with identical ID/scope/body returns the same envelope; mismatch conflicts.
Unique-key races return the current authorized blocking attempt, not a second one.

Browser storage is not authoritative. A minimal nonsecret navigation hint is optional,
but no persistent credentials/private command copies are required. After logout,
clear visible/in-memory data, not the server unresolved envelope. Another user on
the same browser must see none of the prior actor's recovery payload.

## 4. Proposed endpoints and service integration

Use a narrow organization-scoped recovery controller/service with kind-specific
command validation delegated to existing checkout/refund contracts:

```text
POST /organizations/:organizationId/command-recovery             Prepare/freeze
GET  /organizations/:organizationId/command-recovery?kind=        Actor's blockers
GET  /organizations/:organizationId/command-recovery/:id          Read outcome
POST /organizations/:organizationId/command-recovery/:id/submit   Explicit submit/retry
POST /organizations/:organizationId/command-recovery/:id/acknowledge
POST /organizations/:organizationId/command-recovery/:id/abandon   Prepared-only safe cancel
```

Routes are proposed contracts; avoid a general-purpose arbitrary-command executor.
Kind is a strict enum; scope/fields are validated, sizes bounded and actor derived
from current session. GET never submits or mutates financial data. Return a
discriminated status/result, not a completed response when parsing/lookup failed.
Bound list to the actor's two namespaces, not tenant-wide recovery discovery.

Preparation validates shape and permission but is not a stock/price/account
reservation. Require durable prepare success before sending a financial command.
If preparation response is lost, resolve/repeat the same preparation ID—do not
mint a new ID or submit an unpersisted command. Freeze the reviewed input exactly;
server recomputes authoritative amounts on actual completion as today.

Submit loads the stored immutable command and invokes the existing service seam;
never accept replacement payment/item data on retry. Atomically coordinate
envelope/financial completion with existing source uniqueness, actor equality and
command comparison. The authoritative Sale/Refund result and envelope completion
must not diverge after process death. Prefer one transaction for source writes and
envelope completion; if a seam cannot support this safely, require explicit design
review, not hidden best-effort follow-up writes.

All new financial entry points—including old POST routes—must enforce the recovery
envelope/blocking rule, not allow bypass via direct API calls. Reuse existing POST
routes as delegates or reject obsolete unprepared commands in a coordinated
cutover. Do not retain two independent submission paths with different safety.

## 5. State transitions and outcome rules

| Situation                                                                        | Required action                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prepared, never submitted                                                        | Show frozen review; explicit Submit or safe Abandon. No stock/money effects yet.                                                                                                                   |
| Submit requested, response pending/lost, browser closed or schema parsing failed | Keep original ID/body blocked and unknown; reopen with read-only resolution.                                                                                                                       |
| Matching saved outcome exists                                                    | Revalidate scope/actor/command, return immutable saved result; explicit acknowledgement releases same-kind blocker.                                                                                |
| Lookup has no outcome                                                            | Remains unresolved if submission may have occurred. Absence alone does not authorize replacement or imply no physical money moved.                                                                 |
| Explicit unchanged retry                                                         | Existing canonical idempotency gives one result; current eligibility applies only if creating a genuinely new source outcome.                                                                      |
| Proven never-executed rejection                                                  | May close only when a serialized server decision proves no source committed/in flight and forbids delayed execution. Physical collection/payout ambiguity still requires staff/support resolution. |
| Restore/version mismatch/access loss/corrupt envelope                            | Block automatic write/cleanup; safe unavailable/needs-support status under 10.                                                                                                                     |

Prepared abandonment and submit race must serialize on the envelope. Once submission
has begun, no casual Cancel/TTL endpoint can release its blocker. A safely abandoned
command is fenced permanently against delayed submit, including old browser tabs.
Do not infer never-executed from a later 400/403/404/409, an expired client timeout,
an empty current database snapshot or a new account configuration failure.

If same-command retry currently fails eligibility and there is no known outcome,
preserve uncertainty until safe terminal proof exists. Define exact result classes
and fencing before implementation; no generic catch-and-clear. Validation/editing
after a conclusively unsubmitted cancellation creates a fresh reviewed command,
not modification of the uncertain original.

Acknowledgement verifies saved completion, actor/scope and matching result, and is
idempotent across devices. It does not delete the source, issue money, clear another
kind's attempt or prove a physical transfer occurred. Record minimal acknowledged
timestamp. Lost acknowledgement response can be retried or read safely.

## 6. Concurrency, lifecycle and security

Use database uniqueness and transaction locks, not localStorage flags/tab leases,
to enforce one blocker. Two devices preparing/submitting/acknowledging race to one
consistent result. Define lock order with 08/16's branch, participation, inventory
and refund source locks; audit all paths to avoid inverse envelope/branch ordering.
Bound retries, ensure no duplicate stock effects and never hold locks across network
calls or user interaction. No lease expiry may authorize a second uncertain write.

Recover only the original actor's commands with fresh verified identity, membership,
role, branch and sale access. Owner/Manager cannot impersonate another actor to
retry. Support can investigate authorized records under 10; any future transfer or
override is separately approved. Foreign/other-actor IDs retain safe not-found.

07 inactive tenant blocks new writes; 16 inactive branch allows controlled refunds
but not new checkout. Returning an already-completed saved result is distinct from
new execution and must not require current account sellability/availability. Scope
revocation prevents private result exposure; retain a safe unresolved blocker for
the original actor without leaking payload to a newly signed-in person.

Account rename/disable/unassignment or stale stock/price never rewrites frozen
command/account. Completion remains authoritative under 08. Refund recovery keeps
original sale/items/restock/account/reason and existing over-return limits. Warn
against second physical payout and repeated restock; the application cannot verify
external money movement from a saved manual transaction alone.

No auth token/cookie or private command in URLs/analytics/console/alerts. Use 03/05
origin/CSRF/cache/transport rules. Server-side private storage is not protection
from XSS/session compromise; maintain existing security controls and minimal
projection. Rate-limit recovery reads/submission without stranding legitimate
unknown outcomes; quotas/errors never silently clear the blocker.

## 7. Frontend recovery experience

At authorized workspace/feature entry, read current actor blockers before enabling
new same-kind submission. Show a stable Recover checkout/refund panel with scope,
status and minimal safe context. Read on reauthentication/reopen; never auto-submit.
Explicit actions: View saved result, Check status, Retry unchanged command when
permitted, Acknowledge completed result, prepared-only Abandon, Contact support.
Keep checkout/refund namespaces distinct and existing receipt/refund views reusable.

Browser notifications/BroadcastChannel may improve cross-tab updates using native
capabilities, but missed messages do not affect correctness. Fetch current state
after focus/reconnect as bounded reads; no background retry loop. Stale responses
from prior user/tenant/access generation cannot repopulate data. Error boundaries
(11) must not discard envelopes; pending UI cannot unlock a second same-kind write
just because a component unmounted. No blanket browser leave/discard prompt.

Prevent duplicate clicks and make unknown versus failed/complete states clear with
accessible status feedback. A recovered receipt is not a new checkout confirmation.
If offline, explain that outcome cannot be checked and submission is unavailable;
do not queue it to execute automatically later.

## 8. Retention, migration and restore safety

13 defines approved retention/minimization for private frozen payloads, outcome
links and acknowledgements. No fixed unresolved TTL that drops safety. Old unresolved
items escalate; do not keep unnecessary private payload indefinitely without policy.
After resolved retention, purge/minimize under approved rules while preserving
source idempotency and fences needed to reject delayed obsolete submissions.

04/06 forward migrations enforce envelope uniqueness/tenant relations. Existing
in-memory attempts need an explicit cutover: complete or safely register/resolve
the original frozen command before enabling new flow; never assign it another ID.
No fabricated history/backfill and no development reset under this plan. 08's
separately approved development cutover must invalidate stale dataset commands.

Version stored commands and readers. Release must retain interpretation of active
envelopes or block writes for operator resolution; never silently convert old
payment methods, expected prices or refund contents. Unknown command versions are
support cases, not empty carts. Downgrade cannot bypass active blockers.

Database restore can roll back both envelopes and outcomes after external money
moved. Under 04/10, quarantine the affected time interval and verify externally
before accepting new/replayed commands. Persisted same-DB coordination does not
make restore-related exactly-once guarantees. An absent restored row is not safe
proof; detect/document restore epoch operationally and gate recovery before reopening.
No second datastore or automatic reconciliation is introduced to disguise this limit.

## 9. Delivery and verification

1. Finalize versioned state/result/permission contracts, terminal rejection fences,
   lock order, retention and restore gating; deep review before implementation.
2. Add minimal envelope schema/service and kind-specific adapters to existing
   financial service seams. Prepare before submission; authoritative results reused.
3. Deliver read/status/acknowledgement and explicit submit/abandon with existing
   scope/runtime schemas/OpenAPI parity; prevent old-route bypass.
4. Integrate UI startup, reload/device/sign-out/error-boundary handling, preserving
   original frozen commands and namespaces. No automatic financial retry.
5. Test unit/HTTP plus verified disposable PostgreSQL: prepare lost response,
   concurrent same/different IDs, submit/abandon fencing, duplicate submit, commit
   then response loss, completion/event rollback, two devices and ack races.
6. Cover stale prices/stock/account config, current access revoked/relinked,
   actor/tenant/branch guessing, same-ID changed body, partial refunds/over-return,
   actual payout account, restock once, parsing failure and version mismatch.
7. Exercise restart/reload/tab closure, storage absence/private mode, another user
   on same device, fresh same actor on another device, root boundary and network
   recovery. Prove one source record/stock effect and no automatic submission.
8. Rehearse restored-away envelopes/outcomes and retention with 04/10/13. No test
   uses real payment delivery, real tenant data or production restore.
9. Run formatting/lint, app/test-source typing, Prisma validate/generate, full
   relevant unit/HTTP/integration/builds. 11 verifies real browser/a11y; 12 load/
   security; deep financial/concurrency review and 14 sign-off remain required.

Update POS/sales/refunds/frontend and operational recovery docs only when delivered.
Rollback only compatible code retaining blocker/version enforcement and source
records; otherwise halt affected submission through an approved procedure and
roll forward. Never drop envelopes/reset money history to unblock deployment.

## 10. Completion and remaining gates

Complete when same-actor cross-device recovery retains original immutable command,
one blocker per tenant/actor/kind is enforced server-side, saved outcomes require
explicit acknowledgement and all unknown/failure/lifecycle/restore cases avoid
duplicate records, collection/payout instructions and stock effects.

Open technical gates: exact schema/state/fencing implementation, lock order,
safe terminal proof, payload retention/version support and operator restore gating.
User-confirmed cross-device support, same-kind blocking and explicit acknowledgement
are not optional. No system can infer physical money movement solely from missing
database records; unresolved ambiguity remains a 10 support case.
