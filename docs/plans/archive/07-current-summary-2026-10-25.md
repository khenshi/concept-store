# Plan 07: Controlled enrollment, activation and account recovery

Date: October 25, 2026

Status: Completed and archived October 25, 2026. The detailed design is recorded
in [the archived Plan 07 record](07-controlled-access-2026-10-25.md).

Local implementation checkpoint: schema, auth flows, operator lifecycle,
HTTP-level and transaction-level inactive-state enforcement, Resend mail
delivery boundary, automatic verification/reset/invitation delivery, duplicate
registration protection, verification resend cooldown, invitation resend,
explicit acceptance and permanent removal are implemented and verified.
Resend credentials, real delivery, controlled operator staging and migration
rollout evidence were validated. See
`docs/validation/plan07-implementation-2026-10-25.md`.

Unconsumed expired account-action links return a clear expired-link response;
invalid or already-used links remain generic.

## Objective

Implement secure account verification and password recovery, controlled
organization provisioning/activation, inactive-organization write protection,
and reliable invitation delivery/acceptance without introducing a platform-admin
web application, subscriptions, payouts, reconciliation or a general audit
system.

## Confirmed decisions

- Organization provisioning and activation use a protected server-side operator
  command. No platform-superadmin UI is added.
- Verified email is required for workspace access. Unverified users may sign in
  only to reach verification/resend and other explicitly safe account actions.
- Existing organizations and users are preserved; rollout must not silently
  grant verification, delete tenants or reset passwords.
- Deactivated organizations retain authorized read-only history, while new
  writes are blocked server-side. Controlled refund/correction exceptions are
  not approved for this implementation.
- Invitation acceptance requires an explicit Accept action. Page load, preview,
  login or verification completion must not mutate membership.
- Removed invitations are permanently deleted and their links become invalid;
  accepted memberships and historical actor references remain.
- Resend is the approved provider. Invitation email is attempted automatically
  after creation, with Copy link retained. Provider acceptance remains distinct
  from inbox delivery and production credentials/domain verification are release
  gates.
- Password reset is purpose-bound, single-use, does not auto-login, reuses the
  approved 72 UTF-8-byte new-password limit and revokes all sessions atomically.

## Required implementation scope

1. Add additive verification/recovery state and purpose-bound token storage with
   tenant-safe indexes, expiry, single-use consumption and hashed token values.
2. Replace enumeration-prone registration behavior with the approved generic
   acknowledgement and safe pending-registration credential-binding flow.
3. Add verification and password-reset endpoints, forms, routes, safe return
   paths, response schemas and log/referrer protections.
4. Add protected idempotent operator provisioning and activation/deactivation,
   including sanitized operator events and organization-state enforcement in
   mutation transactions.
5. Remove ordinary public organization creation and enforce inactive-organization
   write blocking across relevant services and direct API paths.
6. Add owner rename behavior using existing validation and tenant authorization.
7. Add the shared mail boundary, automatic invitation delivery, resend token
   rotation, explicit acceptance, permanent invitation removal and provider
   failure handling.
8. Update authentication, organization, invitation and runtime/module docs only
   after behavior and tests are complete.

## Explicit exclusions

No automated billing, platform-admin UI, public tenant creation, payouts,
settlements, reconciliation, MFA, OAuth/SSO, arbitrary email changes, Redis,
queues/outbox, general ledger or general audit platform. No additional email
provider dependency, queue or outbox is included; Resend uses the existing Node
runtime fetch boundary. Real messages still require configured credentials and a
verified sender/domain.

## Acceptance gates

- Backend DTOs/services enforce token purpose, expiry, hashing, single-use and
  organization/user ownership; foreign objects use equivalent not-found behavior.
- Registration, verification, reset, invitation and activation races are safe and
  idempotent; stale operation IDs cannot mutate a different target.
- All relevant organization mutation paths recheck active state transactionally.
- Existing Owners/memberships/history remain usable according to the rollout
  policy; no automatic verification or destructive migration is performed.
- Session revocation and 503 behavior remain compatible with Plan 03.
- Frontend API schemas, token pages, explicit actions, loading/error/retry states
  and accessible forms match backend contracts.
- Unit, HTTP, test-source typecheck, build and disposable PostgreSQL concurrency
  tests pass through the Plan 06 workflow. Hosted `/api` cookie/CSRF and real
  mailbox/operator staging evidence remain separate release gates.

## Execution rule

Implement in additive phases: schema and migration, backend contracts and
services, frontend flows, operator/inactive-state enforcement, invitations and
documentation. Preserve rollback safety and do not perform destructive data
changes. Stop at the first unresolved security or business-rule decision:
pending-registration credential binding, Resend sender/domain, operator
identity/host execution, token expiry, existing-user rollout, and inactive-
organization refund/correction exceptions must be resolved before enabling the
corresponding production behavior.

Detailed source review, API proposals, edge cases, rollout rules and test cases
remain in [07-controlled-access-2026-10-25.md](07-controlled-access-2026-10-25.md).
