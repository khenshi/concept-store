# Plan 14: Pilot release and paid-launch sign-off

Date: October 24, 2026

Status: Draft for review; planning only. This is not a release approval. No code,
checklist completion, deployment, activation, purchase or real-data onboarding
is authorized by this document.

Priority: P0 before real pilot use; repeat paid-launch qualification before fees
or a broader public commercial launch. Free testing does not waive data safety.

## 1. Goal and authority

Turn the [deployment checklist](../../deployment-readiness-checklist.md), §8–9,
into an explicit go/no-go process for an exact release/environment and bounded
user population. Reuse plans and their evidence rather than rerun every review
or create a platform approval feature. No schema, API or frontend feature required.

Only explicit user/operator approval authorizes the next release action after
technical gates pass. A drafted plan, archived plan, green build, demonstration,
historical waiver or accepted product scope is not deployment permission.
Finish the planning batch and dependency review first, then promote a bounded
implementation plan into current.md. Do not archive unfinished scopes as complete.

## 2. Confirmed release envelope

- Free controlled pilot: 1–2 organizations, up to five simultaneous staff.
- Existing registered business operates the service; exact identity/contact and
  reviewed policies remain 13's gates. Manual fee collection/activation later.
- Operator-only provisioning, verified email before workspace access, explicit
  invitation acceptance and recovery/delivery under 07 are required.
- Payment Accounts (08), Reports All Branches (09), and durable checkout/refund
  outcome recovery (18) must work before real use. No reconciliation, settlements,
  payouts, automated subscriptions or branch stock transfers.
- Same-origin `/api` is confirmed, but provider/budget/runtime qualification remains
  open under 05. Free-first preference does not authorize spending or lower targets.
- RPO ≤15 minutes and safe RTO ≤2 hours require 04's measured restore/reconnection
  proof, not a published provider retention window. Primary direct support is the
  project owner, without a 24/7 promise; coverage conflict remains open under 10/13.
- Saved receipts/browser PDF may serve initial pilot needs after 11's actual tests.
  Physical printer qualification is deferred, not certified. Do not claim tax-invoice
  or provider-verified-payment capability.
- Manual verified Owner offboarding and tested tenant-scoped handover are required
  before launch, even if optional Reports CSV (19) is deferred.

## 3. Current evidence and gaps

Reviewed current plan, queue dependencies/status, checklist release gates and the
01/10/13 scope and limitations. Earlier plans remain specifications, not completed
features. Known baseline failures need 01 repair and fresh execution. No fresh
application tests, browser, provider, database, alert or restore checks ran for this
draft. No current release is certified ready here.

Plans 16–20 remain to be drafted/reviewed and their release classification resolved.
15 is explicitly optional/nonblocking, except critical findings routed to their
responsible safety plan. 20's Merchant actor-privacy correction is required before
real pilot data; type maintenance is a separate priority decision. 16/17 priorities
must be explicitly decided, not inferred from numbering. 18 is always pre-real-use.

## 4. Pilot evidence gates

| Gate owner | Evidence required for the exact candidate                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 / 06    | Agreed full checks green, including application/test-source typing and real disposable integration/concurrency suites; failing/skipped mandatory jobs are not success. Immutable commit/build/toolchain identified.                 |
| 02 / 03    | Built-process startup, bounded readiness, safe operational logging, session revocation/password rules and request protection verified. Auth/tenant failures are not confused with DB outage.                                        |
| 04         | Target/migration provenance, least-privilege credentials, backup access/freshness, measured separate-target restore with financial/stock/access validation and reconnection inside approved targets. No demo seed/reset in release. |
| 05 / 06    | Approved provider terms/cost/limits, `/api` routing/cookie/origin/trusted-ingress and real port/build behavior; controlled migration-before-app promotion and compatible rollback rehearsed.                                        |
| 07 / 13    | Controlled operator provisioning/activation, verified email/reset/mail/invite workflows, registered operator details, reviewed pilot/privacy/support policies and tested scoped manual handover.                                    |
| 08 / 09    | Authoritative branch-available accounts, immutable history, actual-refund-account attribution, exact scoped received/refunded/net and correct authorized aggregate reports/details.                                                 |
| 10 / 18    | Delivered actionable alerts, named response coverage, outage/escalation drills and durable unknown checkout/refund recovery without duplicate money/stock effects. Include restored-away idempotency records.                       |
| 11         | Representative two-tenant/all-role workflows, access loss, browser/responsive/accessibility and saved/PDF evidence. Printer deferral stated explicitly.                                                                             |
| 12         | Agreed five-staff mixed workload, actual host/query/resource measurements, reviewed dependency findings and deep security/financial/concurrency review; no unresolved critical safety risks.                                        |
| 16–20      | Explicit inclusion/deferral decisions and compatibility evidence; mandatory 18 and 20 privacy correction delivered. Optional CSV/type/refinement work cannot silently become implemented claims.                                    |

No user approval overrides tenant isolation, precise financial integrity or unknown
outcome safety as though these are ordinary cosmetic exceptions. If a critical
gate fails, defer real use or implement an approved narrower safe scope and retest.
Do not waive missing evidence by renaming an issue low priority.

## 5. Sign-off packet and decision record

Maintain one dated packet per candidate under an agreed documentation/evidence
location, excluding secrets and private customer data. Include:

- Candidate commit/artifacts, release ID, schema/migration fingerprints, toolchain,
  environment/region/provider resources and reviewed configuration version.
- Included features, role/branch scope, operating limits and excluded capabilities.
- Gate matrix: pass/fail/not applicable/not run, exact evidence/date/owner,
  outstanding issues and why a gate is or is not applicable. Not run is never pass.
- Distinct local/static, mocked HTTP, real PostgreSQL, hosted, browser/PDF,
  load/security, alert and restore proof. Reuse valid evidence only when candidate/
  environment relevance is documented; do not reuse old counts as current results.
- Named engineering reviewer, operator and business approver. One person may hold
  multiple roles if transparently recorded; do not fabricate independent review.
  Critical security/financial changes still need actual deep review, not this list.
- Accepted noncritical exceptions, impact/mitigation, owner, expiry or trigger and
  user approval. Record physical-printer deferral as scope, not a passed test.
- Exact decision: NO-GO, STAGING ONLY, or bounded PILOT APPROVED, with next authorized
  action. Paid approval is a later distinct decision, never implied by pilot approval.

Credentials, full backups, tokens and tenant exports stay out of the packet/Git.
Source links and sanitized evidence suffice; access to restricted proof is controlled.

## 6. Pilot rollout and stop conditions

1. Complete planning and approved implementations; freeze candidate and run gates.
2. Deploy only to approved synthetic staging first using 06. Rehearse monitoring,
   rollback and unknown-command/restore safety; resolve readiness failures.
3. Present packet and explicit residual limits to the user and pilot Owner. Agree
   pilot duration/review date, support channel/coverage and operator responsibilities
   before activating a real organization. These are not assumed by free registration.
4. After explicit bounded approval, operator provisions/verifies/activates the first
   organization under 07, with correct Cash/account setup and no demo credentials.
   Users complete representative authorized workflows with appropriate guidance.
5. Review incidents, measured capacity, backup/alerts and user task completion before
   activating a second organization. No fixed observation duration is invented;
   agree a period and criteria before rollout. No automatic self-service expansion.
6. Record pilot outcome and remaining paid-launch gates. Material host/schema/auth/
   financial/permission changes invalidate affected evidence and require retesting.

Stop new onboarding or affected operations on tenant leak, duplicate/missing
financial effects, unresolved critical vulnerability, unsafe recovery, backup-age
breach, failed restore qualification, resource exhaustion or unavailable response
coverage. Follow 10's approved procedure; no new global maintenance switch or
silent tenant-wide behavior change is introduced here. Preserve uncertain commands
and evidence. Never reset data, collect again or restore old DB over new writes
just to make release metrics green.

## 7. Paid-launch and infrastructure upgrade gates

Requalify the actual expected paid workload and contracts, not merely five staff.
Before charging or public expansion, approve 13's commercial terms/operator identity,
manual collection/cancellation/offboarding and qualified invoicing/privacy review;
confirm hosting/mail/backup terms permit intended commercial use. Do not infer
permission because pilot stores initially pay nothing. 05 owns current official
provider-term/pricing verification; this plan quotes no guaranteed hosting bill.

Reassess infrastructure before any of these triggers:

- The system becomes the store's sole live checkout record or uptime is promised.
- SaaS fees/public commercial access begin without reviewed provider terms.
- Compute/storage/egress/connection or restore limits endanger availability/data.
- Measured memory/CPU/build/runtime load exceeds qualified capacity.

These trigger evaluation and explicit approved changes, not automatic purchases
or an assumption that the smallest paid instance is enough. A free setup is
acceptable only if it satisfies actual terms and required evidence; otherwise
keep synthetic testing or obtain an approved costed alternative. Never lower
RPO/RTO, security or money-integrity requirements silently to retain free hosting.

## 8. Implementation, verification and completion

Implement a lightweight packet template/checklist/runbook linkage after approval;
no application entity/API or dependency required. 06 runs release automation,
other plans produce proof, and this plan records decisions. Update checklist
checkboxes only alongside actual evidence, preserving failures/limitations.

Validate packet completeness, local links, exact release/environment identifiers,
no contradictory statuses, no secrets and no unassigned blocking gates. Rehearse
a failed gate/no-go and post-deploy stop/rollback decision in staging. Application
tests are required by their owning changes, not replaced by document formatting.
Update runtime/release documentation once procedures exist; pending plans remain
unimplemented until their own definition of done is proven.

Complete this implementation scope when the decision process is usable and a
real candidate is assessed with truthful evidence and explicit authority. NO-GO
is a valid assessed outcome, not pilot approval. Batch planning completion is a
different milestone and requires review of remaining 15–20 and all dependencies.

Open gates: pilot duration/review criteria, exact business/contact, support coverage
versus two-hour RTO, host/cost approval, dataset/browser qualification, 16/17/20
priority decisions and independent/deep review arrangements. Do not resolve these
through invented dates, capability claims or implicit deployment authority.
