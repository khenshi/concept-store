# Plan 10: Monitoring, transaction recovery and outage operations

Date: October 24, 2026

Status: Completed and archived October 26, 2026 after user-confirmed manual
validation. Repository implementation, deployed smoke checking, monitoring and
alert delivery, support coverage, backup/restore rehearsal, quota checks and
incident drills were confirmed. Detailed provider evidence remains outside Git.
The [manual completion checklist](../../operations/plan10-manual-completion.md)
records the completion categories without credentials or private operational data.

Priority: P0 before real pilot transactions. A small pilot still needs tested
alerts, a reachable operator and safe unknown-payment/outage procedures.

Confirmed October 24: the project owner is the primary incident/support contact
for the 1–2 organization pilot. Stores contact them directly; no 24/7 support is
promised. Exact contact channel, availability and any fallback remain to be agreed.

## 1. Goal and boundaries

Detect service/data-protection failures, route actionable alerts to an accountable
operator and recover service without duplicating money records or destroying
history. Own uptime/error/backup/quota alerting and unknown checkout/refund support
runbooks in [deployment checklist](../../deployment-readiness-checklist.md), §6.

Reuse host/database dashboards, Pino and existing application records first. No
new monitoring datastore, queue, ledger, automated financial repair, reconciliation,
offline POS or custom observability platform. No new package unless capability
review proves a need and the user approves. Do not promise a paid SLA or 24/7
staffing for a free pilot.

Plan 02 owns operational logging/readiness implementation; 03 redaction/session
failure behavior; 04 backups and restore mechanics; 05 hosting/proxy/quotas;
06 release orchestration; 07 activation and mail; 08 account attribution;
11 user-facing recovery; 12 workload/security qualification; 13 support/privacy
policy; 14 sign-off; 18 durable outcome recovery. This plan operates their contracts,
not duplicate implementations. No circular requirement: prepare procedures now,
qualify their functioning after prerequisite features exist and before real use.

## 2. Source review and present limitations

Reviewed `backend/src/config/logging.ts`, AppController, sale/refund read route
inventory, frontend checkout/refund attempt stores, queue requirements and checklist.

- `GET /` returns process status only, without database/schema readiness. It cannot
  establish that checkout, migrations or authentication work.
- Pino uses `LOG_HTTP_REQUESTS` as global enablement, accepts bounded client request
  IDs and sanitizes selected query keys. Token-bearing paths and broader privacy
  handling still need 02/03 fixes. Correlation IDs are not authentication evidence.
- Checkout/refund stores are module-memory Maps scoped by organization/user. A
  refresh or closed tab can lose the original command. 18 is required before live
  financial use; a support document is not a replacement for durable recovery.
- Existing source records and replay identity are authoritative. No monitoring/
  alert provider, alert recipient, external dashboard settings or live recovery
  behavior has been verified. Repository smoke validation is recorded separately;
  external operational evidence remains open.

## 3. Minimal monitoring design

Use a small set of named checks with owner, environment, threshold, delivery channel,
runbook link, last successful test and recovery notification. Prefer provider-native
resources and one independent external uptime check if approved and available.
Host selection, permissions, pricing and retention remain gates; no free entitlement
or reliable notification is assumed. Never keep free instances awake to evade quotas.

| Signal                                                  | What it establishes and action                                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Next page and same-origin `/api` liveness        | Public routing/process reachability. Distinguish Next, proxy and Nest failures; not proof of financial health.                                                               |
| 02 readiness and 06 schema compatibility                | Bounded DB reachability plus separately checked migration compatibility. Stop new financial work if either fails; no public database diagnostics.                            |
| Server errors and request latency                       | Sustained 5xx/timeout/latency changes against a measured baseline. Separate auth/permission/validation errors from infrastructure failure; no alert on every legitimate 4xx. |
| CPU/memory, restarts, pool/connection saturation        | Identify overload, OOM, connection limits and deployment regressions. No blind scale-up or automated command replay.                                                         |
| Database storage, compute, bandwidth and service quotas | Alert before enforced exhaustion; nominate cleanup/upgrade action. Cleanup must never delete financial history to free space.                                                |
| Backup freshness, failures and restore qualification    | Last recoverable point within 04's approved RPO, failed/missing jobs, retention and last drill. A successful backup task alone proves neither RPO nor RTO.                   |
| Mail rejection/quota and failed delivery attempts       | Verification/reset/invitation availability under 07. Provider acceptance is not inbox receipt; no authentication bypass during outages.                                      |

Set measured thresholds at deployment, not arbitrary universal numbers. Initial
proposal for review: one-minute external checks, page after two consecutive failed
checks, recovery notification after sustained success. Provider sleep behavior is
not exempt from a real-store reliability gate. Quota warning/critical levels must
leave enough measured response time and capacity; a daily dashboard review alone
cannot meet a 15-minute recoverable-data objective. Rate-limit/deduplicate incidents
and bound notification retries, while retaining visible undelivered-alert status.

Alert delivery must be independent enough that an app/mail outage does not silence
every channel. Name primary and fallback contact or a documented no-fallback
limitation; no anonymous team inbox assumption. Acknowledgement is not recovery.
Record detection, delivery, acknowledgement, mitigation, verification and closure
timestamps. Stop onboarding if required coverage or actionable alerts are absent.

## 4. Safe diagnostic evidence

Use sanitized structured logs with timestamp, environment, service/release ID,
request correlation, safe error classification and latency. Tenant identifiers or
command IDs appear only when necessary in restricted diagnostics; they are not
secrets authorizing access and must not expose customer data in notifications.
Never log passwords, cookies, access/refresh/action tokens, full request bodies,
payment references, customer contacts or financial item payloads by default.
Token routes and provider/edge logs need the same review as application logs.

Restrict dashboard/log/backup access to named operators, with least privilege and
reviewed retention/deletion under 13. Tenant Owners can contact support but cannot
read platform logs or other organizations' incidents. No public debug endpoint or
shared support password. Any necessary operator database read is exact-target,
read-only, authorized and minimized; use existing scoped screens/APIs first.
03 owns any request-ID hardening/redaction change; do not claim current logging
already meets this contract. Do not introduce a general audit service here.

## 5. Unknown checkout/refund outcome runbook

1. Stop repeat collection/payout and preserve the original frozen command and
   request ID through 18. Do not refresh away an unresolved attempt before it is
   safely retained; never edit it, mint a replacement ID or auto-submit on reopen.
2. Reauthenticate if needed, revalidate actor/tenant/branch/source access, then use
   18's read-only outcome resolution. A timeout, 404, unavailable screen, missing
   receipt or lack of visible record is not proof of rollback or absent payment.
3. If a saved outcome is found, inspect the actual sale/refund, account snapshot,
   totals and stock effects through authorized views. Reprint a saved receipt if
   needed; printing must not repeat checkout. A saved manual record is not external
   proof money physically moved.
4. Only offer an explicit unchanged-command retry if 18's service contract proves
   it is valid and preserves idempotency. A changed account, price or item list is
   a different command; do not silently transform the uncertain original.
5. If unresolved, escalate with minimal evidence: environment/release, trusted
   actor, tenant/branch, approximate time and original request/source identifiers
   if available. Do not ask for passwords or tokens. Staff may inspect authorized
   saved-sales/refund history; similar amount/time/reference matches alone are not
   conclusive command identity.
6. Operator verifies authoritative records and command identity read-only if needed.
   Access loss or a missing original command may require continued blocking and
   human investigation, not reconstruction from memory or arbitrary new checkout.
   Do not prescribe direct SQL inserts/deletes or stock edits to hide uncertainty.
7. Record resolution and communicate clearly before further collection/payout.
   New legitimate corrective operations require existing permissions and explicit
   approved workflows; tenant deactivation is not a reason to bypass them.

Refunds need separate checks: whether money was actually handed/transferred is
independent of whether the record committed. Never instruct a second payout while
unknown, and never duplicate restocking. Partial/multiple refunds, original sale
scope and actual payout account must be verified. If external money and application
history diverge, document/escalate; this plan adds no new adjustment/payment ledger.

## 6. Outage and database recovery runbooks

| Incident                             | First safe action and recovery gate                                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend/proxy/API outage            | Identify failed layer and release; preserve unresolved commands and pause new collection. Restore compatible config/build under 06, then verify public routing, auth and readiness. |
| DB timeout/saturation/unavailability | Stop new writes, verify target/pool/provider state; no repeated checkout or migrations. Recover dependency, then verify known outcomes and stock/financial integrity.               |
| Bad deployment/migration             | Halt promotion; follow 04/06's migration provenance and compatibility procedures. No blind resolve/reset/down-migration or old DB restored over new writes.                         |
| Backup failure/age breach            | Escalate urgently and assess exposure. Prove recoverable points or pause real data entry; no untested backup success claim.                                                         |
| Authentication/mail outage           | Preserve sessions/unknown attempts safely, investigate 03/07/provider; no manual token issuance, password sharing or marking users verified as shortcut.                            |
| Suspected tenant leak/compromise     | Restrict affected access through approved controls, preserve minimal evidence and notify responsible operator; coordinate 03/13 incident policy, not broad unreviewed deletion.     |

Database disaster procedure consumes 04's proven restore-to-separate-target steps
and targets: at most 15 minutes lost data, safe recovery within 2 hours including
validation/reconnection. Preserve old evidence, prevent split-brain writers and
verify restored sales/refunds/stock, account relationships, memberships and sessions.
Missing records within a restored interval can invalidate prior replay protection:
quarantine ambiguous commands and manually verify outcomes before retrying, even
if the restored database says absent. Never auto-replay recovered browser commands.

The RPO permits an upper bound on recovery-point loss, not permission to charge
again or invent missing history. Record actual lost interval and affected workflow
uncertainty. Operator validates restored data before resuming service and explicitly
notifies stores of limitations. Do not lower targets to fit a free plan without
user approval. A 2-hour RTO requires staffing/alerting capability as well as a fast
restore command; support-hours policy must be reconciled before real launch.

During an outage, MVP stops system-dependent checkout/refund recording. No offline
sales queue, paper-to-automatic replay or guarantee of stock availability. If stores
want manual business continuity, agree a separate safe policy before promising it.

## 7. Delivery phases and verification

### Current implementation slice

The approved repository slice provides `npm run ops:check`, which performs
read-only checks for API liveness, API readiness, frontend reachability and the
same-origin `/api/health/live` proxy. It never authenticates, retries business
commands, mutates data or replaces provider monitoring. The operator procedures
are recorded in `docs/operations/unknown-transaction-outcomes.md` and
`docs/operations/outage-and-restore.md`.

The manual completion steps and evidence fields are recorded in
`docs/operations/plan10-manual-completion.md`.

The repository and manual operational gates are complete. Plan 18 remains a
separate prerequisite before real checkout/refund use because it owns durable
cross-device outcome recovery.

1. Name contacts/coverage and approve channels, thresholds, privacy retention and
   provider access. Inventory actual 05 capabilities; no spending without approval.
2. After 02–07 contracts exist, wire minimal checks/alerts and versioned operator
   runbooks; record configuration outside Git where required, never credentials.
3. Test in isolated staging: Next/API/proxy failures, DB readiness failure, 5xx/
   latency/limit signals, missing backup, mail rejection and notification failure.
   Verify real delivery, acknowledgement, deduplication and recovery notice; test
   messages are labelled and contain no real tenant/private payment data.
4. After 18, exercise lost response after commit, reload/reopen, explicit same-ID
   retries, cross-tab conflicts, access revocation and actual refund payout
   uncertainty. Verify at most one sale/refund and stock effect on disposable data.
5. Run 04 restore rehearsal with 06 deployment recovery, including pending commands
   whose records are absent after restore. Measure real RPO/RTO and operator
   availability. No production fault injection or destructive drill is implied.
6. Run relevant logging/health/recovery unit/HTTP/disposable-integration tests,
   typechecks/lint/build when implementation changes code. 11 owns rendered outage
   feedback; 12 load/security; 14 requires evidence and residual-risk acceptance.

Update/create runtime-operations documentation alongside 02 and dedicated runbooks
under `docs/operations/` when implemented. Update POS/refunds docs only for actual
support/recovery behavior delivered. Record drill date, environment, release,
measured detection/recovery, approver and failures; checklist remains unchecked
until proof exists. Do not report a static document as an operational drill.

## 8. Completion and safe rollback

Primary support responsibility, coverage, notification channel, retention,
thresholds and quota checks were confirmed by the user on October 26, 2026.
Detailed external evidence is intentionally not stored in the repository. The
no-24/7 pilot policy remains in effect, and the 2-hour recovery target must not be
interpreted as an unattended incident guarantee.

Rollback monitoring configuration without silencing all detection or broadening
access; keep last-known working checks/runbooks. If required alerts or restore/
command safeguards fail qualification, pause real-data onboarding/affected writes
under an explicitly approved operational procedure. Do not use tenant deactivation
as an undocumented global maintenance switch or implement one in this plan.
