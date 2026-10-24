# Plan 13: Privacy, support and commercial-readiness policies

Date: October 24, 2026

Status: Draft for review; planning only. No published legal terms, data collection,
deletion, export, provider contract, registration or production change authorized.

Priority: P0 privacy/data handling, pilot terms, support and offboarding before
real personal/business data; P1 paid-commercial terms before collecting SaaS fees.

Confirmed October 24:

- The pilot operates under an existing registered business. Exact legal name,
  authorized representative and published contact details still require confirmation.
- MVP offboarding uses an identity-verified Owner request handled manually by the
  operator; no self-service organization-delete button is required.
- A tested tenant-scoped manual handover process is required before launch,
  independently of optional Sales Reports CSV exports in Plan 19.

## 1. Goal and scope

Define honest pilot/service boundaries and implement only the minimum supporting
procedures required by the
[deployment checklist](../../deployment-readiness-checklist.md), §7 policies.
This is an engineering implementation plan, not legal advice or certification.
Qualified Philippine privacy/commercial/accounting review must resolve applicability
and retention obligations before claiming compliance.

Preserve confirmed rollout: free controlled pilot for 1–2 organizations, up to
five simultaneous staff; project owner is direct primary support with no 24/7
promise; manual collection/controlled activation later; no automated subscriptions,
settlements, payouts or reconciliation. Saved receipts/browser PDF are acceptable
initially; physical printers remain unqualified. Receipts are internal records,
not a claim of fiscal/tax-invoice compliance.

Include privacy notice, pilot terms, support/contact workflow, retention inventory,
verified data requests/handover/offboarding, incident communications and provider
responsibility review. Exclude a legal-document generator, ticketing platform,
automated privacy portal, generic export system, immediate hard-delete tenant UI
or broad audit infrastructure. New data-processing behavior needs bounded approval.

## 2. Source evidence and gaps

Reviewed auth deletion transaction, Prisma data/relations/snapshots, app route
inventory, checklist and current pending contracts.

- User account deletion checks current password and sole-Owner status, deletes
  memberships/sessions and substitutes profile credentials/name/email. It does not
  delete tenant financial history. Actor FKs and saved cashier/merchant/contact/
  reference data require separate inventory; profile anonymization is not proof
  all historical personal information is erased.
- Tenant/source relations are deliberately restrictive. No general organization
  deletion/offboarding workflow or privacy/terms/support page was found in the
  inspected app inventory. External notices/contracts are unverified, not assumed
  nonexistent. Data handover capability is not established by report pagination.
- 07 plans verification/reset tokens and operator events; 17 member access history;
  18 persisted unresolved commands. Their retention must join this inventory.
- No actual data export/deletion, legal review, browser verification, database
  check or application tests ran for this planning draft.

## 3. Responsibility and notice design

Identify the actual service operator/legal identity, contact address/channel and
privacy-responsible person. Do not invent a company registration, DPO appointment
or certifications. Review whether the operator acts as controller for account/
service operations and processor for store-managed data; that is a proposed role
mapping to validate per processing purpose, not a blanket legal determination.

The Philippine Data Privacy Act distinguishes controller and processor roles;
its IRR addresses notice, processing and retention responsibilities. Use these as
review inputs, not a substitute for assessing this service.
[NPC Act](https://privacy.gov.ph/data-privacy-act/),
[NPC IRR](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/).

Prepare a plain-language notice with reviewed purposes/categories, processing
basis by purpose, recipients/subprocessors, hosting/mail regions and transfers,
retention rationale, rights/request channels and security limitations. Do not make
consent a universal substitute for another appropriate basis, bundle marketing
consent into service access or promise instant erasure of required history.

Keep privacy notice acknowledgement distinct from acceptance of service terms.
Determine the minimum evidence of accepted terms/version/date for the initial
Owner's pilot enrollment; use a controlled operator enrollment record initially
if approved, not an assumed signed contract or silent database flag. Review staff/
Merchant notices and Owner authority separately. If durable acceptance storage or
new API is necessary, approve that narrow schema/contract before implementation.
No general document-signing workflow is implied.

Expose reviewed notice/terms/support through accessible public links and relevant
registration/enrollment/account surfaces using existing shells. Never publish
placeholder contacts or legal text asserting unimplemented guarantees. These pages
do not require another component system or substantial UI redesign.

## 4. Retention inventory and enforcement

For every category record purpose, controller/processor responsibility, access,
retention trigger/window, deletion/anonymization method, restrictions/holds,
backup behavior and accountable operator. Numeric windows remain approval gates:
do not guess a legal financial-retention period or retain everything forever.

| Category                                        | Engineering considerations                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account identity/sessions/action tokens         | Active identity versus deleted profile; expired/revoked grants cleanup; minimum security evidence and revoked-session checks under 03/07.                                |
| Invitations and grants                          | Remove permanently under 07 for every invitation state; preserve accepted membership independently. Do not create a shadow invitation archive.                           |
| Tenant contacts, memberships and access history | Tenant/role access and staff-only fields; removal is not automatic erasure of all historical attribution. 17 owns narrowly scoped event behavior.                        |
| Sales/refunds/items/movements/occupancy         | Precise immutable money/stock/history and personal snapshots need deliberate retention/redaction policy; no cascading deletion to satisfy a generic request.             |
| Account configuration/reference snapshots       | Preserve actual account attribution under 08; no banking credentials. Payment references may contain personal data and are not harmless public IDs.                      |
| Logs/operator events/support evidence           | Restricted minimal evidence, sanitized tokens/contact/payment data and bounded diagnostic retention under 03/07/10.                                                      |
| Browser recovery state                          | 18's actor/tenant/device isolation, sign-out/access-loss policy, expiry and cleanup. Never discard an unresolved financial command merely because a generic TTL expires. |
| Backups/mail/provider copies                    | Provider retention/regions/access and eventual expiry. No promise that a row deletion immediately removes immutable backups or delivered emails.                         |

Implement cleanup only after approved windows and race/hold rules. Prefer existing
database/service mechanisms and a controlled scheduled/operator command if needed;
no queue platform by default. Cleanup must not destroy required idempotency/outcome
records, current sessions or legal holds. Test exact predicates on synthetic data
and provide dry-run counts; destructive execution needs independently verified
target, authorization and recoverability. 04 owns backup policy/mechanics.

After a restore, reapply valid post-snapshot deletion/access decisions through an
approved restricted procedure before reopening access. Do not retain deleted
invitation tokens or broad personal data simply to solve restore bookkeeping.
Agree the smallest lawful deletion evidence with qualified review. Test that a
restore does not silently restore removed invitations, revoked access or expose
offboarded data; financial unknowns follow 10/18, not automatic replay.

## 5. Data requests, handover and offboarding

Use confirmed identity-verified, manually handled Owner requests for MVP.
No Owner-supplied tenant ID alone grants export/deletion authority.
Authenticate the requester and verify current organization role and purpose; a
personal access request is not permission to disclose a whole tenant. Check for
other Owners, disputes, obligations and retention restrictions before action.
Never ask for passwords, access tokens or shared credentials in a support channel.

Distinguish: account deletion; membership removal; tenant deactivation; verified
data handover; irreversible disposal. 07 inactive status keeps authorized read-only
history and blocks new writes—it is not offboarding deletion. Define how/when
offboarded tenants lose read access; existing inactive status does not implement
that separate privacy requirement. Do not invent a purge/status model silently.

For handover, agree contents, format and cutoff with the verified Owner. Proposed
scope: tenant-owned operational/financial records with stable IDs and exact money,
plus necessary relationships; exclude credentials/action tokens, platform logs,
other tenants and unnecessary personal fields. Rights-driven redaction can differ
from normal in-app staff projections and needs explicit policy. No raw shared DB
dump or provider backup as an organization export.

Use a tested bounded, tenant-scoped operator procedure with row-count/total checks,
safe serialization and secure time-limited delivery; approve a minimal script if
existing reads cannot provide complete data. Protect temporary files and clean up
after approved retention. Never send unencrypted broad customer exports through
ordinary chat or store public download URLs. Record minimal request/approval/
delivery/disposal evidence. Plan 19's optional Reports CSV is not a complete
offboarding/data-rights solution or prerequisite for this distinct procedure.

For disposal, approve exact scope/windows, preservation or anonymization obligations,
holds, backups and cross-tenant actor references before designing code. No routine
manual SQL deletes or organization cascade endpoint in this plan. If current
constraints cannot satisfy an approved request, stop for a narrow preservation-safe
implementation plan; never claim a policy document already solves the gap.

## 6. Support, incidents and service terms

Pilot terms state actual free-test duration/exit rules, supported workflow scope,
user responsibilities and access model, data handling, service availability
limitations, contact/escalation path and no 24/7 promise. No invented guarantee of
unlimited capacity, offline use, verified funds, bank balance, tax compliance or
qualified printer support. Claims must match 05/08/10–12 evidence.

Resolve the tension between non-24/7 support and the accepted ≤15-minute RPO /
≤2-hour RTO before real use: state coverage and limitations honestly, improve
coverage or obtain an explicit revised decision; do not silently convert recovery
targets into unsupported promises. 10 owns tested alerting and incident response.

Prepare privacy-incident triage/communication with named responsibility, restricted
evidence, affected tenant identification and qualified notification assessment.
NPC guidance makes breach notification conditional on defined criteria; do not
treat every error as reportable or wait indefinitely for a full forensic report.
Review applicable timing and reporting process at launch and during incidents.
[NPC breach reporting](https://privacy.gov.ph/pips-and-pics/breach-reporting/).
The controller's responsibilities are not automatically transferred by outsourcing.
Coordinate processor/provider escalation and 10's tested operational runbook.

Before paid launch, separately approve contracting identity, pricing/manual fee
collection, renewal/cancellation, suspension/offboarding, liability/refund/dispute
terms and invoicing/tax obligations with qualified advice. No automatic payment
gateway or billing ledger is authorized. Do not draft final legal provisions as
though counsel reviewed them or assume a free pilot exempts personal-data duties.

## 7. Provider and publication gates

Inventory actual 05 host/database and 07 mail providers: data regions, security/
backup/log access, subprocessors, contractual processing terms, transfer review,
retention/deletion/export capabilities and incident contacts. Check official current
terms before approval; do not infer them from a free-tier label. No provider is
chosen or purchased here. Limit external analytics/support tooling unless approved.

Publish only reviewed versioned documents and real contacts, accessible without
tenant secrets. Check keyboard/labels/links and signup/enrollment consistency under 11. If consent/acceptance tracking is approved, validate backend authority and
versioning; changing a checkbox alone does not establish a valid legal basis.

## 8. Phases, verification and acceptance

1. Confirm exact registered-business identity/contact, pilot term/exit scope,
   handover contents and ownership of qualified review. Manual verified requests
   and tested handover are confirmed requirements. Inventory actual provider flows.
2. Obtain approved retention schedule, notice/terms, request/offboarding rules and
   incident/privacy responsibility. Keep unresolved durations visible and block
   real data collection where policy/implementation gaps remain material.
3. Implement only approved minimal public pages, operator request/handover/cleanup
   procedures and required supporting contracts. Promote bounded scope to current
   plan first; no generic privacy platform or silent deletion-policy change.
4. Test with two synthetic tenants: requester verification, foreign-ID rejection,
   complete exact handover, minimized fields, secure delivery, disposal/holds,
   revoked access and restore reapplication. No real tenant data in QA artifacts.
5. Run applicable format/lint/typechecks/tests/builds when code changes. Verify
   public links/accessibility, provider settings and operator drill separately.
   Update relevant account/organization/runtime module docs after actual delivery;
   versioned policy drafts are not implemented behavior.
6. 14 signs off P0 pilot policies/evidence before onboarding, then paid terms before
   charging. No compliance certification or legal guarantee comes from this plan.

Rollback public text/config only to reviewed accurate versions; do not restore
withdrawn consent, erased data or unrestricted tenant access. Destructive cleanup
is not generally reversible: approve safeguards before execution, not afterward.

## 9. Open decisions

Exact registered-business identity/contact; handover contents/delivery details and
actual readiness evidence; numeric retention/backup/hold schedule; offboarding access and
disposal stages; qualified reviewer; provider region/terms; support coverage versus
recovery targets; pilot duration/exit and eventual commercial terms. No unknown is
an implicit approval to collect more data, retain forever, publish legal claims,
export tenant records or delete history.
