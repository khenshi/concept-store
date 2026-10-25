# Deployment readiness plans and implementation sequence

Date: October 22, 2026

Queue updated: October 25, 2026

Status: Plans 01–02 completed and archived October 25. Plan 03 is approved for
staged implementation in the [current plan](../current.md); independent security
work is being verified, with joint Plan 05/07 gates still pending. Other numbered plans remain
pending, not implementation authority. Final batch review remains outstanding;
the user approved these scopes separately without declaring that review complete.

Source: [deployment readiness checklist](../../deployment-readiness-checklist.md).
Verify the implemented modules and clarify documentation/code discrepancies first,
as requested October 23. Then create/review **one detailed plan per planning turn**
and update this file.
Implement only the explicitly approved current scope. Do not advance to another
plan without approval or treat archived specifications as active requirements.

## 1. Planning queue

IDs are stable; filenames in code formatting are planned files, not broken links.
Existing specifications remain the source of truth until their review turn.

| ID  | Plan / intended file                                                                              | Priority                                 | Draft status                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 01  | [Regression baseline and test-contract recovery](../archive/01-regression-baseline-2026-10-25.md) | P0                                       | Completed October 25; local gates and 72 affected PostgreSQL tests passed                                      |
| 02  | [Production startup, logging and readiness](../archive/02-production-runtime-2026-10-25.md)       | P0                                       | Completed October 25; local/deep review/disposable-process gates passed                                        |
| 03  | [Authentication and request-boundary hardening](../current.md)                              | P0                                       | Approved staged implementation October 25; local implementation/verification in progress; joint 05/07 gates open |
| 04  | [Database migration, isolation and recovery safety](04-database-safety.md)                        | P0                                       | Approved for staged implementation October 25; seed safeguards and empty/current migration rehearsal recorded; recovery/provider proof pending |
| 05  | [Hosting selection and secure session topology](05-hosting-session-topology.md)                   | P0                                       | Drafted October 24; same-origin `/api` confirmed; provider/budget open; implementation not approved            |
| 06  | [CI and repeatable release pipeline](06-ci-release-pipeline.md)                                   | P0                                       | Drafted October 24; repository/host settings unverified; implementation not approved                           |
| 07  | [Controlled enrollment, activation and account recovery](07-controlled-access.md)                 | Required before pilot                    | Drafted October 24; operator/read-only/verification policies confirmed; implementation not approved            |
| 08  | [Payment Account Management and Reporting — finance-reconciliation.md](finance-reconciliation.md) | Required before pilot                    | Source-reviewed/updated October 24; policy clarifications open; implementation not approved                    |
| 09  | [Reports All Branches — 09-reports-all-branches.md](09-reports-all-branches.md)                   | Required before pilot                    | Source-reviewed/updated October 24; technical contracts/proof pending; implementation not approved             |
| 10  | [Monitoring, transaction recovery and outage operations](10-operational-reliability.md)           | P0                                       | Drafted October 24; coverage/channel/drill gates open; implementation not approved                             |
| 11  | [End-to-end workflow, accessibility and receipt acceptance](11-workflow-acceptance.md)            | P0/P1 by risk                            | Drafted October 24; saved/PDF pilot confirmed; browser proof pending; implementation not approved              |
| 12  | [Performance, dependency and security qualification](12-performance-security-qualification.md)    | P0 critical risks; P1 scale gates        | Drafted October 24; five simultaneous staff confirmed; execution evidence pending; implementation not approved |
| 13  | [Privacy, support and commercial-readiness policies](13-service-policies.md)                      | P0 personal-data controls; P1 paid terms | Drafted October 24; registered business/manual requests/handover gate confirmed; implementation not approved   |
| 14  | [Pilot release and paid-launch sign-off](14-release-signoff.md)                                   | P0 pilot; P1 paid launch                 | Drafted October 24; no release approved; remaining batch/dependency review pending                             |
| 15  | [Optional interface and documentation refinements](15-optional-refinements.md)                    | P2                                       | Drafted/classified October 24; explicitly nonblocking; implementation not approved                             |

### Added during module verification

| ID  | Plan / intended file                                                                    | Priority              | Draft status                                                                                         |
| --- | --------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| 16  | [Branch lifecycle enforcement](16-branch-lifecycle.md)                                  | Required before pilot | Drafted October 24; Owner-only status/controlled closure confirmed; implementation not approved      |
| 17  | [Directory pagination, member access history and POS browsing](17-member-management.md) | Required before pilot | Drafted October 24; Owner-only history/15-product POS batches confirmed; implementation not approved |

### Checkout and refund recovery addition

| ID  | Plan / intended file                                                | Priority                                 | Draft status                                                                                     |
| --- | ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 18  | [Durable checkout/refund outcome recovery](18-checkout-recovery.md) | Required before real checkout/refund use | Drafted October 24; cross-device/blocking/acknowledgement confirmed; implementation not approved |

Plan 18 owns the recovery feature; Plan 10 consumes it in the operator runbook.
Coordinate with session/access behavior (03/07), Payment Accounts (08), branch
lifecycle (16) and checkout/refund acceptance (11). Implement and qualify 18 before real
checkout/refund use and final release sign-off (14). No specific storage technology or
new infrastructure is selected by this manifest.

### Reports export addition

| ID  | Plan / intended file                                         | Priority             | Draft status                                                               |
| --- | ------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| 19  | [Scoped Sales Reports CSV exports](19-report-csv-exports.md) | Optional after pilot | Drafted October 24; optional timing confirmed; implementation not approved |

Plan 19 depends on existing report contracts and must integrate the reviewed 08/09
account/all-branches scopes. Do not make it a pilot blocker without confirmation.
If included in a release, qualify its authorization, accuracy and resource limits
before 11/12/14 sign-off; otherwise document explicit deferral.

### Spaces maintenance and privacy addition

| ID  | Plan / intended file                                                                   | Priority                   | Draft status                                                                                          |
| --- | -------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| 20  | [Space-type maintenance and occupancy actor privacy](20-spaces-maintenance-privacy.md) | Both required before pilot | Drafted October 24; archive/reactivation/current-label history confirmed; implementation not approved |

Plan 20 reuses existing Spaces authorization and catalog relationships. Coordinate
with database safety (04), branch lifecycle (16) and final qualification (11/14).
Stage the privacy correction separately if type maintenance is deferred; do not
leave Merchant actor disclosure pending behind an optional catalog enhancement.

IDs remain stable. Draft 16 through 20 after the existing queue; implement approved scope
before final workflow/release qualification (11/14), not after release sign-off.
Plan 15 remains optional. Plan 16 must coordinate with Payment Accounts (08) and
operational recovery (10) without duplicating their rules.

`finance-reconciliation.md` now describes Payment Accounts, not reconciliation.
Keep its existing link stable during initial staging. No reconciliation workflows,
settlements, payout engine or automated subscription billing belong in this batch.

## 2. Implementation order and dependencies

The planning queue above is sequential. Implementation has prerequisites and may
use the following waves **only after the planning stage is finished and approved**.
This is not authorization to run work in parallel or deploy anything now.

1. **Repair the local foundation:** 01, then 02 and 03. Verify existing behavior
   before changing security boundaries. A failing baseline must be triaged, not
   bypassed by deleting assertions or excluding test files.
2. **Prepare safe infrastructure contracts:** 04 and 05, then 06. Host selection in
   05 determines the bounded proxy/cookie settings verified by 03. Agree that
   topology before finalizing those settings; do not leave a circular dependency
   requiring a public deployment to test them. Use isolated staging/disposable
   tests and source contracts first. 04 owns migration/backup policy; 06 executes
   that policy in release automation rather than inventing a second procedure.
3. **Deliver required product controls:** 07, then 08, then 09. Use the reviewed
   Payment Accounts model when integrating account aggregates with All Branches.
   All Branches is still required after planning; its pending status is not a
   cancellation. Rehearse 08 schema changes using 04 safety gates before release.
4. **Prepare operations and policy:** 10 and 13. Policy decisions may be collected
   earlier, but personal-data handling, recovery ownership, incident contacts and
   terms must be accepted before real pilot onboarding. Forgot-password recovery
   and email verification are now required before the first pilot organizations
   start, not deferred to paid launch. Paid commercial terms remain a P1 gate.
5. **Qualify the complete candidate:** 11 and 12 after the required features and
   staging setup are ready. Run actual integration/race, role/tenant, browser,
   printer, restore and workload checks; do not substitute builds for these.
6. **Approve the bounded release:** 14 consumes the evidence from 01–13. Admit
   only the agreed pilot organizations. Require a separate paid-launch sign-off
   and fresh provider-term/cost/capacity review before charging or promising uptime.
7. **Optional later work:** 15. Do not postpone a critical accessibility, security
   or data-integrity defect here simply because it appears in the UI.

After each implementation phase, update its module documentation and checklist
evidence. Archive only the completed scope, recording any remaining gates. Pending
and archived plans never independently authorize implementation.

## 3. Checklist coverage / primary ownership

The section/action descriptions below map the entire source checklist. Evidence
consumers may reference another plan without duplicating its implementation.

| Checklist section / actions                                                                                                                              | Primary plan(s)                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| §1 confirmed rollout, exclusions, priority definitions; §2 implemented-versus-proposed inventory                                                         | All plans preserve scope; 14 confirms release boundaries     |
| §3 startup command, production logging, dependency readiness                                                                                             | 02                                                           |
| §3 bcrypt byte boundary, trusted proxy/rate-limit identity, database outage versus invalid-session errors                                                | 03                                                           |
| §3 failing automated checks; §4 all six frontend failures, backend pagination assertions and full test-source typecheck                                  | 01                                                           |
| §3 actual target migration state, including SpaceOccupancy provenance                                                                                    | 04                                                           |
| §5 account registry, branch availability, snapshots, dynamic amounts/charts and actual refund-account attribution                                        | 08                                                           |
| §5 authorized All Branches counts/rankings/pagination/period/navigation                                                                                  | 09                                                           |
| §5 controlled enrollment/activation; recovery decision and invitation delivery/expiry/email matching                                                     | 07                                                           |
| §6 identity: two-organization/branch authorization smoke, revoked/relinked/historical access                                                             | 11; security test matrix reviewed with 03                    |
| §6 secrets/rotation/environment/origins, cookie/CORS/CSRF topology and deployed login/refresh/logout/deletion/password-change behavior                   | 05; 03 owns revocation-window policy and backend enforcement |
| §6 log redaction/exception disclosure, SQL parameters and production Swagger exposure                                                                    | 03; 02 preserves logging availability                        |
| §6 dependency advisory/license and secret scans, severity triage                                                                                         | 12                                                           |
| §6 separate databases/credentials, least privilege, migration baseline, backup/restore, destructive seed exclusion, pool/timeout/cold-wake/outage safety | 04                                                           |
| §6 enforced CI, runtime/package versions, build roots/start/PORT, release identifier/migration ordering/compatibility/rollback                           | 06; 02 owns executable runtime correction                    |
| §6 meaningful database/schema readiness                                                                                                                  | 02; 06 consumes readiness in releases                        |
| §6 uptime/errors/backups/quota alerts and named incident contact                                                                                         | 10                                                           |
| §6 unknown checkout/refund outcomes, in-memory attempt loss and offline store fallback                                                                   | 10; 11 exercises the runbook and existing retry contracts    |
| §7 full role/workflow acceptance; money, stale stock/price, retries/unknown outcomes, navigation/refresh                                                 | 11                                                           |
| §7 printer/browser/paper/reprint; internal-not-fiscal receipt limitations                                                                                | 11; 13 owns qualified invoicing-policy clarification         |
| §7 keyboard/focus/dialog/calendar/responsive/zoom/motion/table/contrast; slow/error/empty/loading states and route-level retry/not-found decisions       | 11                                                           |
| §7 realistic directory/history scale and measured pagination needs                                                                                       | 12                                                           |
| §7 privacy/terms/support/retention/export/deletion/offboarding and named ownership                                                                       | 13                                                           |
| §7 P2 hints/visual consistency/docs cleanup and lockfile-root warning                                                                                    | 15; promote any release-breaking build issue to 06           |
| §8 hosting choice, free-tier limits, cookie topology and budget                                                                                          | 05                                                           |
| §8 four upgrade triggers: sole checkout reliance, commercial terms, quotas/restore limits and measured memory                                            | 14, using current 05 provider review and 12 measurements     |
| §9 product/engineering/operations/pilot/hosting sign-off, release/environment/date/evidence and expiring exceptions                                      | 14                                                           |

Section 4 test counts are dated observations. Section 8 provider limits are also
dated; recheck official terms when drafting 05 and before release. No plan may
certify these findings as current simply by copying the audit.

## 4. Shared gates and decisions

Confirmed during Authentication and Accounts verification on October 23:

- Plan 07 owns forgot-password recovery, email verification and necessary mail
  delivery. They must be implemented and verified before the initial pilot;
  manual support alone no longer satisfies this requirement. Define verification
  enforcement and safe treatment of existing users in the detailed plan.
- Plan 03 owns active-session viewing and selected-session revocation, including
  a clear access-token revocation contract. The approved implementation uses
  account-owned 15-row pages with ID, creation, expiry and current metadata only.
- Plan 03 also owns registration anti-enumeration behavior and dedicated
  password-change/account-deletion rate limits. Plan 11 owns changing the deletion
  confirmation to the documented outlined design and its interaction coverage.
  User requested behavior changes, not documentation-only corrections.
- Authentication focused verification passed the Plan 03 backend/frontend suites,
  plus nine real-PostgreSQL session-integrity scenarios on an isolated target.
  This is not deployed, browser/two-tab, hosted-proxy or Plan 07 proof. Other
  modules still need verification; do not treat the full module audit as complete.

Confirmed during Organizations verification on October 23:

- Keep the existing chooser cards and in-memory Reports-period persistence.
  Plan 15 owns correcting the outdated module wording; do not redesign either.
- Plan 07 includes Owner-only organization renaming, with backend tenant/role
  checks, existing name validation and safe workspace refresh. No unrelated
  branding, billing fields or organization deletion is implied.
- Only the platform operator may provision organizations. Plan 07 must replace
  unrestricted tenant creation with backend-enforced operator-only provisioning;
  organization ownership alone must not confer platform provisioning authority.
  The secure operator mechanism and initial Owner assignment remain design gates,
  not authorization for a platform-superadmin module or manual database writes.
- Focused Organizations verification passed 8 backend and 88 frontend tests.
  No browser, deployed or real-database concurrency verification was performed.
  These decisions do not mean the missing controls or rename feature exist.

Confirmed during Branches verification on October 23:

- User selected option 2: inactive branches should block new operations and retain
  historical access, rather than remain label-only. Plan 16 owns the operation
  matrix, backend enforcement and frontend unavailable-state handling.
- Define which sales, stock, placement, participation and space commands are
  blocked, and which refunds/corrections/closure actions remain allowed, including
  roles, reactivation and in-flight command/idempotent-retry behavior. These are
  unresolved design gates; do not silently prohibit recovery or rewrite history.
- Current Branches behavior is still label-only. Focused verification passed 15
  backend unit and 12 mocked HTTP tests; frontend had 33 passes and the one known
  obsolete hint assertion. Plan 01 retains the confirmed hint-free design.
- October 24: enforcement is required before pilot. Status changes become Owner-only;
  assigned Managers retain ordinary detail editing. Inactive branches permit
  authorized existing-sale refunds, existing-stock corrections, occupied-space
  release and participation deactivation, within existing action permissions.
  Tenant inactivity still blocks new writes; unlisted edits and lock rules remain gates.

Confirmed during Organization Memberships verification on October 23:

- Plan 17 owns server-side member search and pagination, defaulting to 15 rows.
  Define bounded query validation, stable ordering, total/page metadata, search
  fields and behavior after member changes; preserve Owner-only scoped APIs.
- Plan 17 also owns focused access-change history: actor, time and before/after
  values for role changes, branch grants/revocations, merchant relinking and member
  removal. Define transactional recording, no-op/failure behavior, history access,
  retention and safe actor/target handling after removal/deletion. Do not collect
  passwords, tokens or unrelated personal data or introduce a global audit system.
- Preserve last-Owner protection and existing transaction/concurrency safeguards.
  Coordinate with 03 session behavior and 07 operator provisioning; organization
  access revocation is not the same as deleting the user's account or sessions.
- Focused verification passed 14 backend unit, 12 mocked HTTP and 19 frontend tests.
  Real PostgreSQL race tests and rendered/browser QA were not run. These results
  do not establish that the new search/history features exist.
- Release priority remains to be confirmed. Include approved scope before final
  11/14 qualification, or record its explicit deferral at release review.

Confirmed during Invitations verification on October 23:

- Plan 07 owns explicit invitation acceptance: show an Accept invitation button
  for the matching signed-in account; opening the link must not create membership.
  Preserve authenticated matching-email, expiry/single-use and pending/retry guards,
  and coordinate with the newly required email-verification policy.
- Plan 07 includes automatic invitation emails with Copy link retained. Reuse the
  planned mail capability for verification/recovery; choose provider and delivery
  failure/retry behavior explicitly. Do not treat saving an invitation as proof
  that its email was delivered, or assume queues/new infrastructure are necessary.
- Plan 17 extends member-table work with server-side invitation email search,
  status filtering and default 15-row pagination. Define stable sorting, page/count
  metadata and mutually consistent pending/expired/accepted/revoked predicates on
  the backend, including time boundaries and page behavior after removals.
- Plan 07 also owns the earlier unfulfilled removal requirement: permanently
  delete invitations in every state and invalidate removed links. Acceptance
  membership/grants must survive later invitation deletion. Define deletion versus
  acceptance races and preserve tenant isolation; do not silently retain revoked
  invitation rows under a Remove action.
- Focused verification passed 24 backend and 21 frontend tests; no real database
  race, browser or deployed mail tests ran. Current auto-accept/manual sharing/
  revoke-active behavior remains unchanged until approved implementation.
- These additions are confirmed planning scope; release priority and provider
  decisions remain open. Update Invitations and Memberships module docs only
  after the corresponding behavior is actually implemented.

Confirmed during Merchant Profiles verification on October 23:

- Extend Plan 17 with server-side merchant pagination, default 15 rows. Preserve
  current name/ID ordering, search/status filters, Owner/Manager/Merchant scopes
  and contact-data restrictions. Manager search must not expose hidden contacts.
  Inspect shared merchant selectors before changing the existing list contract;
  paginating the directory must not silently truncate selector choices.
- Keep the current standard creation-modal size. Plan 15 owns correcting the
  conflicting compact/wide wording, not a modal redesign.
- Plan 11 owns approved merchant status-confirmation guidance: explain blocked
  new sales, product/placement creation and stock receipts, the affected space
  count/release, and preserved history and stock balances. Reactivation guidance
  must explain that operations remain subject to other eligibility checks and
  previously released spaces are not restored. Verify copy against backend rules;
  do not imply refunds/corrections are blocked or change business behavior.
- Focused checks passed 14 backend unit, 9 mocked HTTP and 25 frontend tests.
  Browser and actual database concurrency behavior remain unverified.

Confirmed during Merchant–Branch Relationships verification on October 23:

- User approved planning the OpenAPI page-limit correction from 10 to 15 and a
  regression assertion. Plan 01 owns this narrow contract repair; actual backend
  pagination and frontend validation already use 15 and must not be changed.
- Focused checks passed 3 backend participation-helper and 9 frontend tests.
  Database-backed service authorization/concurrency tests were inspected, not run.
  No additional business module was requested.

Confirmed during Products verification on October 23:

- Extend Plan 17 with server-side product pagination, default 15 rows, preserving
  name/SKU/barcode search semantics, merchant/status filters, stable name/ID order,
  tenant isolation and role scope. Inspect consumers before evolving the list
  contract; directory pagination must not silently truncate other workflows.
- Plan 11 owns approved product-status guidance: explain restrictions on selling,
  new placements and stock receipts, with prices, balances and history preserved.
  Reactivation remains subject to merchant/participation and stock eligibility.
  Do not change operational rules or imply permitted refunds/corrections stop.
- User confirmed retaining affiliation-based Manager product identity visibility,
  including unplaced products from merchants affiliated with assigned branches.
  Inventory/placement stock and price reads remain assigned-branch-only; product
  identity management remains Owner-only. Plan 15 owns correcting the older
  placement-only visibility wording, not changing access rules. Plan 17 must
  preserve this distinction when paginating the directory and its consumers.
- Focused checks passed 76 backend unit and 62 frontend tests. Actual database
  transaction/concurrency and browser checks remain unverified this turn.

Confirmed during Branch Inventory verification on October 23:

- Plan 15 owns correcting outdated descriptions of Manager eligible-product
  visibility, eligible-product default page size (15), integrity Previous/Next
  pagination and removed dirty-form discard prompts. Preserve current behavior;
  do not restore old prompts, Load more controls or placement-only Manager scope.
- Plan 01 includes the explicitly approved narrow default change: initialize new
  inventory placement forms with threshold 5, matching API/product-opening-stock
  defaults. Keep 0 valid for opting out, retain validation, and do not migrate or
  overwrite existing saved thresholds. Add coverage for default 5 and explicit 0.
- Branch-to-branch stock transfers are excluded for now; do not create a transfer
  plan or imply corrections constitute a linked transfer workflow.
- Focused verification: 121 backend unit tests passed; frontend 146 passed and 1
  known failure; mocked HTTP 111 passed and 2 known failures. All three failures
  are already owned by Plan 01. Real DB concurrency and browser QA were not run.

Confirmed during POS verification on October 23:

- Plan 15 owns fullscreen documentation cleanup: keep branch name beside POS,
  exit action, and hidden branch selector/Cart/History controls. Do not restore
  older fullscreen navigation or change presentation behavior.
- Extend Plan 17 with bounded Load more browsing for the POS product list. Define
  server continuation, stable ordering and client loading/error/end states while
  preserving search semantics, scoped minimal projection, disabled product rows
  and exact-code scanner lookup. Reset continuation on scope/filter changes;
  deduplicate results and reject obsolete responses. Loading never modifies stock
  or an existing cart; checkout remains authoritative for current price/stock.
- Do not turn POS browsing into 15-row table pagination by assumption. Its batch
  size/continuation design remains a detailed-plan decision; it must not return
  an unbounded catalog or introduce speculative infrastructure.
- User approved durable checkout recovery after reload/tab closure, required
  before real checkout use. Plan 18 must preserve the original frozen command/
  request ID and resolve completed outcomes, offering explicit unchanged-command
  retry only; refresh/reopening must never submit automatically or ask staff to
  collect again. Current implementation is still memory-only.
- Plan 18 must define minimal persisted data, retention/cleanup, account/tenant/
  branch isolation, fresh authorization, shared-device/sign-out behavior, cross-tab
  conflicts, stale prices/stock and command-version compatibility across releases.
  A missing lookup alone must not be treated as proof that no sale committed.
  Do not clear an uncertain attempt on a later rejection or mint a new command
  without a proven safe resolution. Do not persist credentials/payment secrets.
- Use existing persisted sales/idempotency records as authoritative; no duplicate
  transaction ledger, offline checkout, provider verification or general cart-draft
  persistence is implied. Storage/API choices and recovery limits require detailed
  design and a deep financial/security/concurrency review before implementation.
- Plan 10 retains a saved-sales verification/escalation fallback when recovery
  cannot establish an outcome. Acceptance must include response loss after commit,
  reload/close/reopen, repeated retries, multiple tabs and revoked access, with
  proof of at most one sale and stock deduction for the original command.
- Focused checks: 3 catalog and 37 checkout-DTO backend tests passed; frontend
  119 passed and the known Plan 01 cart-copy assertion failed. Actual checkout
  concurrency, browser and printer behavior were not verified this turn.

Confirmed during Sales verification on October 23:

- Plan 15 owns correcting the older documented API default of 50 to the current
  15 rows. Keep the existing immutable sale/item snapshots and refund-based
  correction workflow; do not add sale editing/deletion. Payment Accounts (08)
  and durable checkout recovery (18) remain separate approved planning scopes.
- Focused checks passed 62 backend unit/DTO and 87 frontend tests. Actual database
  concurrency, rendered browser behavior and receipt printing were not verified.

Confirmed during Refunds verification on October 23:

- Extend Plan 18 to durable refund outcome recovery, with the same before-real-use
  safety gate as checkout. Recover the original frozen command/request ID and sale
  scope after reload/reopening; retrieve a completed refund or permit explicit
  unchanged-command retry. Never automatically submit on refresh, issue money,
  request another payout, duplicate a refund record or repeat stock restocking.
- Preserve fresh actor/tenant/branch/sale permissions, current over-return checks,
  original refund replay rules and separate checkout/refund namespaces. Define
  retention/cleanup, shared-device and cross-tab handling, account/branch lifecycle
  changes and release compatibility. Reuse suitable recovery infrastructure only
  after design; no generic framework or duplicate payment ledger is required.
- Plan 10 retains manual record verification/escalation when recovery cannot prove
  an outcome. Test committed-but-lost responses, explicit retries, reload/reopen,
  revoked access, concurrent return attempts and completion-read acknowledgement.
- Plan 15 owns correcting stale refund forms-as-future-work and Reports detail
  navigation descriptions. Preserve actual in-place refund modal behavior.
- Focused verification passed 69 backend unit, 82 mocked HTTP and 118 frontend
  tests; actual database concurrency and rendered browser behavior were not run.
  These additions are planning scope, not implemented recovery.

Confirmed during Sales Reports verification on October 23:

- Plan 15 owns correcting outdated summary-only frontend and obsolete date-range
  restriction descriptions. Retain current analytics, period presets/All time,
  long-period pagination, tab routes and existing authorization behavior.
- Plan 19 owns CSV exports for Transactions, Daily Data and Rankings, respecting
  applied dates, filters, ranking sort and fresh authorized branch scope. Export
  the full matching result, not just the visible page, and clearly identify scope,
  date boundaries and ordering. Merchant exports must contain only own permitted
  rows/columns; Cashiers remain denied. Do not reuse staff columns for Merchants.
- Reuse authoritative reporting predicates/calculations; do not scrape the DOM,
  duplicate financial calculations, sum rounded display values or query outside
  authorized scope. Define consistency across export reads and concurrent writes.
- Preserve exact decimal/sign values, Manila dates and textual identifiers such
  as leading-zero barcodes. Protect untrusted cells from spreadsheet formula
  execution, correctly escape CSV, and test Unicode, commas, quotes and newlines.
- Define bounded memory/runtime, export limits and explicit handling of oversized
  requests with no silent truncation. Recheck access on export requests, keep
  private commands/contact/payment fields out of unauthorized output, and define
  safe download/error behavior. Do not assume queues, stored export files or new
  dependencies; first design the smallest supported synchronous/bounded solution.
- Integrate Payment Accounts (08) and All Branches (09) without duplicating those
  plans. Export generation remains read-only and adds no profit, settlement,
  payout or general finance functionality. Release priority remains unconfirmed.
- Focused checks passed 74 backend unit and 45 mocked HTTP tests; frontend had
  282 passes and the known Plan 01 currency-prefix failure. Real DB calculation/
  performance and browser checks were not run. Exports are not implemented.

Confirmed during Spaces verification on October 23:

- Plan 15 owns correcting older focus/layout/style descriptions, preserving current
  heading focus for Add Space, compact rows and current form/column design.
- Plan 20 must restrict Released by actor ID/name to staff. Merchant occupancy
  responses must omit this identity at backend selection/projection and frontend
  schema/rendering boundaries; do not expose it in nested/current/history/merchant
  views or leaks through stale staff state. Preserve their own occupancy dates and
  business data. Owners and authorized assigned Managers retain staff visibility;
  Cashiers remain denied Spaces. Retain internal audit attribution.
- Plan 20 adds Owner-only space-type rename/archive management with backend role/
  tenant enforcement. Preserve existing space references and occupancy history;
  do not delete types/occupancies or orphan archived/existing spaces. Define case-
  insensitive uniqueness, no-op/conflict behavior, reactivation policy, and which
  archived types can remain on existing spaces versus be selected for new edits.
- Inspect the current name-based composite foreign key, registration trigger and
  API consumers before choosing rename mechanics or schema changes. Define
  historical display behavior and concurrent space/type edits explicitly; do not
  silently change every historical label or let legacy writes reactivate types.
  No speculative new catalog abstraction is approved.
- October 24: privacy correction and type maintenance are both required before
  pilot. Archived types retain existing uses, reject new selections and can be
  reactivated by Owners. Rename displays the current label in occupancy history.
  Technical archive/trigger/concurrency proof remains pending. Add tenant/
  role/API projection tests plus disposable migration/concurrency tests where
  required. Update module documentation after implementation, not before.
- Frontend verification: 41 passed, 1 known Plan 01 layout assertion failed. Spaces
  has no matching backend unit tests; real PostgreSQL suites were not run. Source
  inspection does not certify overlap, migration state or concurrency behavior.

Confirmed during shared Frontend Experience verification on October 23:

- Plan 11 includes explicit route-level error and not-found recovery. Choose the
  narrowest correct boundary placement after inspecting persistent workspace/POS
  layouts; an error boundary must not silently discard unknown checkout/refund
  attempts, authorize access, or replay mutations. Keep recovery reads distinct
  from explicit same-command retry and coordinate with durable recovery (18).
- Define safe retry/navigation actions, private diagnostic handling and current
  authorization revalidation. Foreign/missing resources must retain equivalent
  not-found behavior. Test render failures, unavailable records, access loss,
  pending/unknown commands, repeated retries and remounts; avoid adding boundaries
  everywhere without a demonstrated failure-handling need.
- Plan 15 consolidates the frontend current-behavior reference. Separate obsolete
  five-row pagination/layout descriptions and historical delivery/commit counts
  from current contracts. Preserve historical evidence and browser-QA limitations
  in appropriate existing validation/archive references; do not erase failures or
  present old waivers as current launch qualification. Keep current UI designs.
- Focused shared/app-shell checks: 42 passed, 1 known Plan 01 validation-copy
  assertion failed. The limited component detector reported no findings; keyboard,
  responsive/zoom, theme contrast, reduced-motion and actual dialog/calendar
  behavior remain unverified and belong to Plan 11 browser qualification.
- The first module-by-module source/focused-test pass is complete. Resume detailed
  plan drafting at 02 after presenting the remaining decisions and dependency
  gates. This is not completion of the pending-plan batch or deployment sign-off.

Remaining shared gates:

- Resolve significant business decisions in the owning plan before implementation;
  document the question and its impact rather than assume an answer.
- Hosting/domain budget, approved cookie/proxy topology, password compatibility,
  legacy-password/old-token cutover, controlled activation administration, recovery identity
  verification and retention/restore targets need explicit decisions.
- Reuse confirmed Payment Accounts decisions: Cash always available, configurable
  references, one account per sale/refund, actual refund payout account, assigned
  Manager access and signed bars for negative net. Split payments remain later.
- All Branches remains Reports-only and authorized-scope-only for existing Reports
  roles. Never widen POS/Inventory selectors or merchant financial access.
- No reset now. Any later development reset requires exact target verification;
  that permission does not extend to real pilot data or production.
- New dependency/infrastructure proposals need demonstrated necessity and approval.
  No speculative queues, Redis, offline POS, billing/admin platform or general ledger.
- Keep checklist boxes unchecked until evidence exists. Every release must state
  which checks ran locally, in disposable integration tests, in browser/device QA,
  and on the actual deployment.

## 5. Progress

- Completed now: planning-stage scope and sequence/coverage manifest. Both existing
  feature drafts are in pending and explicitly queued for review as items 08–09.
- Plan 01 drafted after source review and focused reproduction: 6 frontend
  failures, 2 inventory HTTP failures and 25 backend test-source type diagnostics.
  These remain unfixed; user confirmed keeping branch inputs hint-free and
  updating the obsolete test/documentation contract during implementation.
- Plan 02 drafted after runtime source/artifact inspection and 13 passing focused
  config/controller tests. Startup/logging/readiness fixes remain unimplemented;
  real process/DB/deployment proof is still required by the plan.
- Plan 03 is in staged implementation after auth/session/request-boundary source
  review. New-password byte limits, session-bound JWTs, own-session controls,
  request-boundary redaction and auth dependency handling are locally implemented
  and verified. Plan 05/07/browser/deployed gates remain.
- Plan 04 drafted after migration/seed/runtime/test-harness inspection. Prisma
  validation passed; no database was contacted. User confirmed October 24 an RPO
  of at most 15 minutes and RTO of at most 2 hours. Migration/backup/restore evidence
  is not established; 05 must assess hosting against these targets without assuming
  free-tier capability or authorization to spend.
- Plan 05 drafted after source inspection and official hosting/session documentation
  review. Same-origin `/api` routing is confirmed. Focused checks passed: 10 backend
  and 17 frontend tests. Provider/budget decisions and actual deployment, browser
  cookie/proxy identity and recovery qualification remain open; no deployment or
  purchase is authorized.
- Plan 06 drafted after package scripts, lockfiles, TypeScript/Jest configuration,
  integration harness and release-checklist review. Defines required verification,
  isolated databases, least-privilege workflow contexts, approved migration/release
  ordering and compatible rollback. No CI, build, database or deployment executed;
  operational settings and hosted qualification remain open.
- Plan 07 drafted after auth/organization/invitation/schema/frontend source review.
  User confirmed protected operator commands, inactive-organization read-only history
  and verification required for workspace access. Mail provider, signup credential
  binding/cutover, operator identity and any refund/correction exception remain
  implementation gates. No application tests, database or mail delivery ran.
- Plan 08 source-reviewed/updated October 24 in the existing Payment Accounts file.
  Reconfirmed original-sale-method versus actual-refund-account attribution, fixed
  schemas and canonical checkout replay. Added 07/09/16/18 contracts, scope/privacy,
  coordinated development-only cutover and rollback gates. User confirmed Owner
  sidebar placement, references required by default with future-only edits, and
  fixed Cash/unique custom names. Display bounds and exact reset target remain
  gates. No new application tests, database or browser checks ran.
- Plan 09 reviewed/updated after Reports routes, service authorization, analytics,
  frontend selector/entry and source route inspection. Preserves merchant historical
  branch union and defines aggregate identity, empty states, per-request consistency,
  Payment Accounts integration and rollback/navigation safety. No new application
  tests, database or browser checks ran; runtime acceptance remains pending.
- Plan 10 drafted after logging/health, checkout/refund attempt storage, source-read
  route and checklist review. Defines actionable alerts, privacy-safe diagnostics,
  unknown-outcome escalation and restoration safety including missing replay records.
  User confirmed they are primary direct pilot support with no 24/7 promise.
  Channels/coverage/fallback and actual drills remain gates; no application tests,
  database, monitoring configuration or alerts ran.
- Plan 11 drafted after design/module, route inventory, receipt and shared dialog/
  feedback source review. Includes role workflows, safe route recovery, approved
  confirmation guidance, accessibility and saved/PDF acceptance. User confirmed
  saved receipts/PDF initially; printer testing deferred and devices undecided.
  No application tests, browser, printing or database checks ran for this draft.
- Plan 12 drafted after opt-in performance harness, rate limits, runtime pool/config
  and bootstrap review. User confirmed up to five simultaneous pilot staff. Defines
  mixed-load/query, dependency/security and financial-concurrency qualification;
  dataset/host/budgets remain gates. No benchmarks, audits, database or network
  security probes ran; no dependencies changed.
- Plan 13 drafted after auth deletion/schema/snapshot and public-route review,
  with official NPC guidance as qualified-review inputs. Distinguishes profile
  anonymization, tenant history, handover, inactivity and disposal. Legal identity,
  details and retention remain gates. User confirmed an existing registered business,
  manual verified Owner requests and tested tenant-scoped handover before launch,
  independent of optional Reports CSV. Handover evidence remains pending. No legal documents
  published, application tests, data exports/deletions or database checks ran.
- Plan 14 drafted after checklist/queue and foundation/support/policy contract
  review. Defines exact-candidate evidence gates, no-go/approval records, bounded
  pilot activation and distinct paid-launch/upgrade decisions. No release approved,
  checklist gates closed, application tests or operational drills performed.
- Plan 15 drafted/classified P2 after module-review records, affected descriptions,
  Sales default DTO/tests and docs index review. Maps current-behavior corrections,
  historical-evidence preservation and critical-finding routing. No module docs,
  application behavior, tests or database changed for this draft.
- Plan 16 drafted after branch status/controller/service, checkout authorization,
  stock/product-initial-stock and participation-lock/space transaction review.
  Pre-pilot priority, Owner status changes and controlled closure confirmed by user.
  No application tests, database, browser or concurrency checks ran for this draft.
- Plan 17 drafted after membership/invitation services, list DTOs/consumers and POS
  catalog/code paths review. User confirmed all scope pre-pilot, Owner-only access
  history and 15-product Load more batches. Defines complete bounded options,
  transactional history and cursor/search safety. No application tests, database
  or browser checks ran; retention/consumer/cursor details remain gates.
- Plan 18 drafted after memory attempt stores, canonical replay, source persistence
  and strict result validators review. User confirmed same-actor cross-device
  recovery, server same-kind blocking and explicit completed acknowledgement.
  Proposes minimal durable command coordination, no duplicate ledger. Fencing,
  lock/retention/version/restore gates remain open; no tests or database checks ran.
- Plan 19 drafted after report query/projection/service review and OWASP CSV safety
  guidance. User confirmed optional after pilot; Plan 13 tested handover stays
  required. Defines full-scope bounded reads, Merchant-safe columns, exact values,
  no truncation and supported spreadsheet tests. No actual exports/tests/DB checks ran.
- Plan 20 drafted after name-based FK/cascade, registration trigger, shared occupancy
  projection and frontend schema/rendering review. User confirmed both parts pre-pilot,
  retained archived uses/reactivation and current-label history. No application tests,
  migration/database or browser checks ran; privacy and concurrency proof pending.
- October 25: user explicitly approved Plan 01 for implementation. Moved it to
  current.md and archived the planning-stage document as superseded, not completed.
  Source/local repairs and follow-up 72 affected PostgreSQL tests passed on a fresh
  verified disposable target (benchmark enabled). Plan 01 completed/archived;
  Plan 01 committed as 297665e. User then approved Plan 02; it is completed and
  archived after 564 unit/267 HTTP tests, two built-process checks and deep review.
  No production DB/deployment. Current.md remains the active staged Plan 03 scope;
  no approval for Plans 04 and 05–20 is implied.
- Next after current scope: final batch coverage/dependency/open-decision review
  and explicit approval of any next implementation. Drafting alone repairs nothing.
- Batch completion: 01–14 and 16–20 drafted/reviewed, 15 explicitly classified as optional,
  remaining decisions visible and dependencies reviewed with the user. Only then
  close the planning stage and seek approval for the next implementation scope.
