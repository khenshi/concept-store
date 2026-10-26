# Plan 07: Controlled enrollment, activation and account recovery

Date: October 24, 2026

Status: Completed and archived October 25, 2026. This file records the approved
design, implementation contract and completed acceptance evidence.

Implementation and hosted acceptance checkpoint October 25, 2026: schema,
auth/operator/access, transaction-level inactive mutation rechecks, Resend
delivery, automatic account/invitation email delivery, invitation resend,
existing-user rollout, protected operator staging and hosted verification were
validated. The plan is archived after the user-confirmed acceptance gates passed.

Priority: Required before the first pilot organizations start, including email
verification and forgot-password recovery. Manual support alone is insufficient.

## 1. Goal and confirmed decisions

Provide secure account onboarding/recovery and controlled tenant enrollment without
a platform-admin application or automated billing. Own the controlled enrollment,
verification/recovery and invitation delivery/acceptance requirements in the
[deployment checklist](../../deployment-readiness-checklist.md), §5.

Confirmed October 24:

- Only the platform operator provisions and activates organizations, using a
  protected server-side command rather than a platform-admin web page.
- Deactivated organizations retain authorized read-only history; new writes are
  blocked. Refund/correction exceptions require a separate explicit policy.
- Verified email is required for organization workspace access. Unverified users
  may authenticate to a verification/resend screen, not access tenant resources.

Previously confirmed: manual fee collection; Owner-only organization renaming;
automatic Resend invitation emails plus Copy link; explicit Accept invitation action;
permanent deletion of every removed invitation without deleting accepted members.

Excluded: subscriptions, payment collection, invoices, payouts/settlements,
reconciliation, public tenant creation, a platform-superadmin role/UI, arbitrary
email changes, general audit infrastructure, queues or outboxes. Account
registration does not create an organization. Preserve current chooser cards and
report-period preferences. No new application dependency was added; Resend uses
the existing Node runtime fetch capability.

## 2. Current source evidence and weaknesses

Reviewed `schema.prisma`, auth controller/service, organizations controller/service,
organization access guard, invitation service/acceptance page and module docs.

- `User` has no email-verification state or purpose-specific recovery tokens.
  Registration currently issues a session and returns duplicate-email conflict;
  03 owns replacing this enumeration-prone contract with safe acknowledgement.
- Any authenticated user can `POST /organizations`; service transaction creates
  an organization and makes that caller Owner. No activation state exists.
- Organization guard derives current membership/role but has no verification or
  tenant-activation policy. Direct service/invitation paths also need review.
- Invitations already use random tokens stored hashed, expiry and transactional
  acceptance with role/branch/merchant grants. Preserve these rather than inventing
  another membership system. Public preview intentionally has limited fields.
- Matching authenticated accounts automatically accept in a frontend effect.
  No mail integration exists. Active invitation removal currently revokes rather
  than permanently deletes; accepted/expired/revoked removal can delete.
- Existing module documents describe those implemented behaviors, not this plan.
  No fresh application tests, database, mail or browser checks ran for this draft.

## 3. Smallest proposed data model

Use Prisma/PostgreSQL and existing auth/organization modules:

- Add nullable `User.emailVerifiedAt`. Server reads current state rather than
  trusting a frontend flag or stale access-token claim.
- Add one focused account-action-token table: user FK, unique token hash,
  explicit purpose (VERIFY_EMAIL or RESET_PASSWORD), expiry, creation and consumed
  timestamps. Index actual user/purpose/expiry lookup/cleanup patterns. Tokens are
  cryptographically random, opaque, purpose-bound, hashed at rest and single-use.
  Do not reuse invitation or refresh tokens for these purposes.
- Add a simple organization state (ACTIVE/INACTIVE), without trial/subscription
  entitlements or scheduled expiry. Provision inactive until explicitly activated.
- Add narrowly scoped operator-event records for provisioning/activation changes:
  stable operator identity, operation/request ID, tenant ID, timestamp, reason and
  before/after state. No raw credentials, financial receipts or token values.
  This is not member access history (17) or a general auditing framework.
- Reuse invitation records/grants; keep provider delivery metadata minimal and
  separate from the public preview. Do not persist raw invitation tokens merely
  to implement resending. Mail retention/cleanup is coordinated with 13.

Migration uses 04's verified-target procedure. Existing users start unverified
unless separately approved evidence supports verification; do not invent proof
of mailbox ownership. Inventory existing organizations, then explicitly approve
which remain active. No migration silently grants operator power or deletes data.
Stage rollout so existing Owners can verify before enforcement; no unconditional
verification bypass for old accounts. Emergency access requires reviewed procedure,
not permanent backdoor credentials. No development reset is authorized here.

## 4. Account onboarding, verification and recovery

### Contracts and user flow

Proposed API additions (final DTOs/OpenAPI agreed with 03 before implementation):

```text
POST /auth/verification/request     Generic acknowledgement/resend
POST /auth/verification/confirm     Consume token and verify associated email
POST /auth/password-reset/request   Generic acknowledgement
POST /auth/password-reset/confirm   Consume token and set new password
PATCH /organizations/:organizationId  Owner-only name update
```

Registration switches atomically with frontend/03 to a generic acknowledgement,
not an `AuthResponse` for new emails and an error for existing ones. Re-registering
must never replace an existing password/profile or grant a session. Prevent signup
pre-hijacking: verification must not let a victim inherit an attacker-selected
password. Define and test the pending-registration credential-binding design
before coding; one simple candidate is setting the final password only through
the verified signup link. Do not add a verification flag that leaves unsafe
pre-created credentials usable. This contract is a security design gate.

Correct-password login may return an unverified account session limited to account
verification, logout and explicitly safe account operations. Enforce the allowlist
server-side; all tenant lists/details/data and invitation acceptance require
verification. No workspace render or API access solely because a token exists.
Recovery remains available without a session. Authentication errors must not reveal
whether a supplied email exists or is verified.

Token links open frontend forms; GET/page loads and email scanners never consume
tokens or accept invitations. Confirm via an explicit POST action. Build URLs from
validated configured public origin, never request Host or caller-supplied redirect.
Allow only existing safe local return paths; revalidate invitation after verifying.
Keep tokens out of analytics/referrers/logs, browser persistence and error reports;
use restrictive referrer policy and no third-party content on token pages.

Suggested expiry values for review at implementation: verification 24 hours,
password reset 30 minutes. Keep existing invitation expiry unless separately
changed. Bound resend attempts per account and trusted client identity through
03, plus provider quotas; no account lockout caused by another person's requests.
Public unknown/known-email requests have the same response shape/status and safe
navigation. Do not claim identical timing or mail delivery that was not accepted.

Reset transaction atomically validates/consumes a usable token, updates bcrypt
password and revokes all sessions and outstanding reset grants. Reuse 03's approved
72-byte UTF-8 limit and immediate subsequent-request token rejection. Concurrent
confirmation succeeds once; replay/expired/deleted-user tokens fail safely. Do not
auto-login after reset. Ask the user to sign in again; preserve unresolved 18
commands safely without issuing financial retries. Verification cannot restore a
deleted account or grant membership. Password reset is not automatically email
verification unless that explicit combined policy is separately approved.

## 5. Protected operator workflow and activation

Implement a narrow non-HTTP command using existing Nest services and deliberate
operator/runtime boundaries. Provisioning takes validated tenant name, an existing
verified initial Owner identity, reason and unique operation ID. An unregistered
Owner first registers/verifies; never generate/shared-email a default password.
Create organization plus initial membership atomically, inactive by default.
Reject operation-ID reuse with different inputs; make a lost-response repeat
resolvable without duplicate tenants. Names need not become globally unique.

Remove/deny ordinary `POST /organizations` even for organization Owners. No
public replacement operator endpoint or client-provided `isOperator` field.
Authorize command execution through restricted hosting/operator credentials and
a documented named-operator mechanism, not possession of an email argument.
Audit identity must not be accepted as proof merely because an argument supplies
it. Verify the selected host can provide restricted execution and reliable operator
attribution; otherwise stop for a reviewed access mechanism. No manual SQL edits
as the routine product workflow; migration credentials are not app credentials.

Operator activation/deactivation requires exact tenant ID, expected prior state,
reason and operation ID, with atomic state/event writes. Manual fee collection
is external; record only the activation reason, not a billing ledger. Deny stale
concurrent changes, confirm exact target and log sanitized outcomes. Reactivation
does not recreate memberships, restore assignments or change branch/merchant status.

### Access while inactive

| Operation                                                                                          | Proposed rule                                                                          |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Scoped history/reports and saved command outcome lookup                                            | Allow only currently authorized verified members; same role/branch projections remain. |
| New checkout/refund, inventory/space/catalog/account configuration or invitation/membership writes | Block server-side while inactive. New exceptions remain unapproved.                    |
| Login, account recovery, verification and logout                                                   | Independent of tenant activation; another active organization remains usable.          |
| Operator activation                                                                                | Protected command only; tenant Owner cannot self-reactivate.                           |

Recheck activation in authoritative mutation transactions, not only HTTP guards;
define serialization with deactivation so in-flight mutations have an explicit
order. Commands already committed remain queryable, never erased. Distinguish
read-only outcome lookup from retrying a write: do not let a retry create a new
refund after deactivation. Coordinate exact idempotent-replay semantics with 18
and inactive-branch policy in 16 before implementation. No force-logout of all
users: one account may belong to other active tenants.

Owner rename reuses current name validation, tenant context and role checks;
inactive-tenant writes remain blocked. Refresh shell/chooser identity safely and
preserve IDs/history. No unrelated branding or deletion feature.

## 6. Invitation delivery, acceptance and removal

- After creation commits, automatically attempt delivery through one small
  feature-neutral mail boundary reused for verification/reset. Provider choice,
  sender/domain verification, free-tier permission/limits and any spending require
  approval. Resend is the selected provider; sender/domain verification and
  runtime credentials were configured and validated for the pilot.
- Preserve Copy link and actual expiry. Owner UI distinguishes invitation saved
  from email accepted by provider; provider acceptance is not inbox delivery.
  Creation/mail failure never falsely reports a rolled-back invitation. Use bounded
  synchronous send initially, no queue/outbox unless proven necessary and approved.
- Explicit resend rotates a hashed invitation token atomically and returns a new
  Copy link; old links become invalid. UI warns of that effect. Recheck invitation
  eligibility and tenant activity before rotation/send. Concurrent sends may cause
  an older unusable message; no invalid link can grant access. Do not blindly
  retry a creation request after a lost response and generate duplicate records.
- Verification/reset resend issues fresh purpose-bound tokens with bounded
  lifetime/attempts and explicit invalidation rules. Never email current passwords.
  No raw tokens in persistent retry records. Provider failure uses generic public
  feedback and sanitized internal evidence; authenticated owner delivery feedback
  can be specific without leaking other tenants. Recovery outage triggers 10's
  support runbook, not a manual verification/password bypass.
- Replace acceptance effect with explicit Accept invitation button. Page load,
  login/verification completion and preview do not mutate membership. Preserve
  matching-email, expiry, current role/grants and serializable acceptance rules.
- Delete every removed invitation and its grants transactionally, including active
  ones. Deleted links are unavailable; acceptance races resolve to one valid
  ordered result. Accepted memberships and historical actor references remain.
  Keep existing revoke action distinct if retained; Remove means permanent removal.
  Delayed email after removal cannot resurrect its token. 17 owns list pagination,
  email search/status filtering and member access history, not this plan.

## 7. Implementation phases and verification

1. Agree 03 registration/verification credential binding and legacy cutoff;
   choose/approve sender/provider, token expiries and named operator access. Define
   inactive-tenant matrix against every write path with 16/18. No guessed exceptions.
2. Implement additive schema and atomic token/operator services using 04 migration
   rehearsal. Tests cover token hashing, expiry, single-use/concurrent claims,
   foreign tenant objects, activation races and operator command replay.
3. Deliver verification/reset/mail with auth API/client/runtime-schema/OpenAPI
   parity and 03 immediate revocation. Add forms/routes using existing guest shell,
   shared inputs/dialogs/loading and safe return-path helpers. Prevent token leaks
   and automatic actions; verify keyboard, focus and error/retry behavior.
4. Restrict provisioning, implement activation enforcement and Owner rename.
   Cover all roles, direct API/service bypass, deactivated history, ordinary users
   guessing operator fields, last-Owner invariants and unrelated tenant access.
5. Deliver invitation email/Copy link/resend, explicit acceptance and permanent
   removal. Test provider rejection/timeout, accepted-but-response-lost mail, expired
   links, mismatched email, unverified user, duplicate clicks, accept/delete races,
   failed grant rollback and preserved accepted membership after deletion.
6. Run format/lint, full application AND test-source typechecks, builds, unit/HTTP
   suites and verified disposable-Postgres integration/concurrency tests through 06. Do not weaken 01 baseline failures. Test real hosted `/api` cookies, request
   origin checks, current session state and token-log redaction with 03/05.
7. Prove actual delivery to controlled mailboxes, recovery end-to-end and approved
   operator execution in staging; never send test messages to real store contacts.
   Record provider delivery separately from inbox receipt. Review security-sensitive
   implementation deeply before real pilot approval under 14.

Update authentication/accounts, organizations, invitations and frontend module docs
only after implementation, plus operator/mail runbooks and OpenAPI contracts.
No general finance, membership or tenancy refactor is included.

## 8. Rollout, rollback and unresolved gates

Deploy compatible schema/auth/client together under 04–06. Rehearse existing-user
verification without marking everyone verified, resetting passwords or deleting
tenants. Explicitly notify initial Owners about enforcement and changed invitation
links. Do not roll back to code that restores unrestricted tenant creation or
ignores verification/inactive-state gates. Roll forward or restrict onboarding if
mail/auth cutover fails; preserve financial data and saved outcomes.

Completed: Resend sender/domain and real delivery, token expiry behavior,
pending-registration credential binding, existing-user rollout, operator
identity/host restrictions and hosted verification were validated. Refund and
correction exceptions for inactive organizations remain excluded; the implemented
policy is no new writes with authorized history/outcome lookup only.

These are implementation gates, not authorization to activate tenants or send
emails to real store contacts. No deployment or business-data change
occurred during planning.
