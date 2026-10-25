# Current plan

## Deployment readiness: sequential planning stage

Date: October 22, 2026

Status: Superseded October 25, 2026 by explicit user approval to implement Plan 01.
Final batch review remains outstanding; this archive does not certify it complete.
Originally approved documentation-only task. No product implementation, deployment,
dependency installation, database reset or migration execution is authorized.

### 1. Goal

Turn the [deployment readiness checklist](../../deployment-readiness-checklist.md)
into focused implementation plans under `docs/plans/pending/`, one plan at a
time. Maintain a [sequence README](../pending/README.md) showing coverage,
dependencies, unresolved decisions and implementation order.

This stage comes before implementing any of those plans. Do not interpret a
drafted plan, a checklist finding or an archived specification as approval to
change application behavior.

### 2. Confirmed scope and preserved work

- Initial rollout is a free, controlled pilot for 1–2 organizations, followed by
  a separately qualified paid launch. Free hosting is not a reliability guarantee.
- Payment Account Management/Reporting and Reports All Branches are required.
- October 23 module-review decisions: forgot-password recovery and email
  verification must be available before the first pilot organizations start.
  Include active-session viewing and selected-session revocation in the pending
  authentication scope. Plan behavior changes for registration email enumeration,
  dedicated password-change/deletion rate limits and the outlined deletion
  confirmation; do not merely rewrite documentation to match those discrepancies.
  These are planning requirements, not implementation approval.
- Merchant settlements, payouts, reconciliation and automated subscription billing
  are excluded. Manual fee collection and controlled activation remain the scope.
- October 23 Organizations review decisions: retain the chooser cards and
  in-memory report-period persistence; correct outdated documentation later.
  Add Owner-only organization renaming to Plan 07. Only the platform operator
  may provision organizations; ordinary authenticated users and organization
  Owners must not create additional tenants through self-service or direct APIs.
  Plan 07 must define the smallest secure operator workflow, initial Owner
  assignment and treatment of existing tenants without assuming a full admin
  platform or choosing an operator identity from client input.
- October 23 Branches review decision: choose option 2, replacing label-only
  inactivity with backend-enforced restrictions on new operations while preserving
  history. Queue a separate branch lifecycle plan (16). Define permitted refunds,
  corrections and closure actions before implementation; existing behavior remains
  label-only until an approved implementation changes it. Keep branch inputs
  hint-free as already confirmed in Plan 01.
- October 23 Memberships review decisions: add server-side member search and
  pagination with a default of 15 rows, plus tenant-scoped member access-change
  history showing actor, time and before/after values. Queue these together as
  Plan 17. Preserve Owner-only management, last-Owner protection, existing role/
  branch/merchant rules and historical attribution. This is not approval for a
  general audit platform; history visibility, retention and release priority must
  be defined in the detailed plan.
- October 23 Invitations review decisions: require an explicit Accept invitation
  action instead of automatic acceptance; automatically email invitations while
  retaining Copy link; extend Plan 17 with server-side invitation email search,
  status filtering and 15-row default pagination. Plan 07 owns delivery/acceptance
  and the outstanding requirement to permanently delete every removed invitation,
  invalidate its link and preserve any membership already created by acceptance.
  Mail-provider choice, delivery failure/retry rules and release priority require
  definition in the detailed plan. No implementation is authorized by this record.
- October 23 Merchant Profiles review decisions: add server-side merchant directory
  pagination with 15-row defaults to Plan 17, preserving search/status filters,
  tenant isolation and role-specific projections/search fields. Keep the existing
  creation modal size; Plan 15 may correct conflicting compact/wide wording.
  Plan 11 must clarify status confirmations: explain restrictions on new sales,
  products/placements and stock receipts, affected space releases, preserved
  history/balances, and that reactivation does not restore space assignments.
  This is approved guidance-only scope; do not change lifecycle rules.
- October 23 Products review decisions: add server-side product directory
  pagination with a default of 15 rows under Plan 17, preserving existing search,
  merchant/status filters and scoped projections. Plan 11 must clarify that
  inactive products cannot be sold, placed or receive stock, while saved balances,
  prices and history remain. These are pagination/guidance requirements, not
  changes to eligibility rules. Keep affiliation-based Manager product visibility,
  including unplaced products from affiliated merchants in assigned branches;
  stock/prices remain assigned-branch-only and product identity remains read-only.
  Plan 15 must correct the older placement-only visibility wording.
- Reuse the existing pending Payment Accounts specification rather than drafting
  another conflicting model. Review its remaining policy decisions in its turn.
- The former current All Branches plan is preserved, unimplemented, in
  [pending as queue item 09](../pending/09-reports-all-branches.md).
  Revalidate it at its turn and retain its approved business decisions. Payment
  Accounts (`pending/finance-reconciliation.md`) is explicitly queued as item 08.
  Both remain queued for implementation after this planning stage.
- October 23 Branch Inventory review decisions: keep current behavior and correct
  outdated Manager visibility, eligible-product page-size, integrity-pagination
  and discarded-draft prompt documentation under Plan 15. Set the new inventory
  placement form's initial low-stock threshold to 5 under Plan 01; retain explicit
  0 as the opt-out and preserve existing saved thresholds. Do not add branch-to-
  branch stock transfers to this planning batch.
- October 23 POS review decisions: keep current fullscreen behavior and correct
  conflicting documentation under Plan 15. Add Load more product browsing to Plan
  17, preserving branch/role/catalog eligibility and search semantics. Define a
  bounded continuation contract rather than fetching the entire catalog; scanner
  exact-code lookup remains independent. Durable checkout recovery after reload/
  tab closure is now approved planning scope (18), required before real checkout
  use. Preserve the original frozen command/request ID securely, resolve saved
  outcomes, and permit only explicit same-command retries; never automatically
  submit checkout on reopening. Define retention, user/tenant isolation, access
  revalidation and cross-tab coordination. This is not offline POS or draft-cart
  persistence and does not authorize implementation yet.
- October 23 Refunds review decisions: extend Plan 18 to durable refund outcome
  recovery after reload/reopening, preserving the frozen original command/ID,
  explicit retries and fresh actor/tenant/branch/sale authorization. Prevent duplicate
  refund records and restocking; never automatically issue money or instruct a
  second payout while the original outcome is unresolved. Plan 15 must remove
  stale future-work and Reports-navigation descriptions from refund documentation.
  Existing actual-account attribution remains owned by Plan 08.
- October 23 Reports review decisions: Plan 15 must correct obsolete summary-only
  frontend and date-range restriction descriptions, preserving current behavior.
  Add optional scoped CSV exports for Transactions, Daily Data and Rankings as
  Plan 19. Export all matching rows for the applied period/filters, not only the
  visible page, with fresh tenant/branch/role checks and Merchant own-only fields.
  Define bounded generation, exact values, formula-injection protection and
  interaction with Payment Accounts (08) and All Branches (09). Release priority
  is not established; this is approved planning scope, not implementation.
- October 23 Spaces review decisions: Plan 15 must correct conflicting focus,
  layout and row-style descriptions while retaining current UI. Released-by
  identity must be staff-only: omit actor ID/name from Merchant responses on the
  backend and client schemas, not merely hide a column. Add Owner-only space-type
  rename/archive management as Plan 20, preserving existing references/history.
  Plan 20 also owns the narrow actor-projection correction and must define archive
  selection rules, rename semantics, concurrency and migration compatibility.
  These are planning requirements; no implementation or database change is approved.
- October 23 shared Frontend Experience decisions: Plan 11 must include explicit
  route error/not-found recovery that preserves unresolved checkout/refund safety,
  revalidates access and never automatically resubmits commands. Plan 15 must
  consolidate current frontend behavior and separate obsolete layouts/defaults
  and historical delivery evidence, preserving current designs and relevant
  verification limitations. The first module source/focused-test review pass is
  complete; database/browser/deployment qualification remains outstanding.
- Preserve all unrelated application and documentation edits. Do not mark old
  browser/printing waivers or audit test counts as current launch acceptance.

### 3. One-plan-at-a-time workflow

1. The first source/focused-test module review pass is complete. Resume plan
   drafting while retaining its recorded decisions and outstanding evidence gates.
   Future verification remains read-only; scope decisions belong in planning
   records, not implemented-module documentation. Use the next unfinished numbered row
   in the pending README. The next detailed
   step is **final batch coverage, dependency and open-decision review**. All
   numbered plans are drafted/reviewed, but the planning stage is not complete.
   Plan 20 is [drafted](../pending/20-spaces-maintenance-privacy.md): both parts are
   confirmed pre-pilot; archived types retain uses/reactivate and renamed labels
   display throughout space history. Privacy/trigger/migration proof remains open.
   Plan 19 is [drafted](../pending/19-report-csv-exports.md), confirmed optional after
   pilot. Column/size/spreadsheet safety contracts remain gates; Plan 13's required
   manual tenant handover is independent. No CSV functionality implemented.
   Plan 18 is [drafted](../pending/18-checkout-recovery.md): cross-device same-actor
   recovery, server-enforced same-kind blocking and explicit completion acknowledgement
   are confirmed. State/fencing/retention/restore proof remain implementation gates.
   Plan 17 is [drafted](../pending/17-member-management.md): October 24 confirms all
   scope pre-pilot, Owner-only history and 15-product POS batches. Retention,
   consumer/cursor contracts and actual proof remain gates; nothing implemented.
   Plan 16 is [drafted](../pending/16-branch-lifecycle.md): October 24 confirms
   pre-pilot enforcement, Owner-only status changes and controlled closure on
   inactive branches. Unlisted edits/lock ordering remain implementation gates.
   Plan 15 is [drafted/classified](../pending/15-optional-refinements.md), explicitly
   P2/nonblocking. Documentation corrections preserve current behavior; critical
   findings remain with their safety owner. Plans 16–20 and batch review remain.
   Plan 14 is [drafted](../pending/14-release-signoff.md): candidate-specific go/no-go,
   pilot activation, upgrade triggers and separate paid approval are planned. No
   release is approved; 15–20 and batch dependency review remain outstanding.
   Plan 13 is [drafted](../pending/13-service-policies.md): notices, support, retention,
   verified requests/handover and offboarding are planned. Existing registered
   business operation, manual verified Owner requests and tested tenant-scoped
   handover before launch are confirmed. Exact business details, retention,
   handover proof and qualified review remain gates; nothing was published.
   Plan 12 is [drafted](../pending/12-performance-security-qualification.md), with
   five simultaneous pilot staff confirmed. Dataset/host/budget and actual
   performance, dependency and security evidence remain qualification gates.
   Plan 11 is [drafted](../pending/11-workflow-acceptance.md). Saved receipts/browser
   PDF are confirmed acceptable initially; actual printer qualification is deferred.
   Browser/device setup and real workflow/accessibility/PDF evidence remain gates.
   Plan 10 is [drafted](../pending/10-operational-reliability.md): alerting, outage and
   uncertain-outcome support procedures are planned. The project owner is confirmed
   as direct pilot support with no 24/7 promise. Coverage/channels and
   recovery drills remain gates; no operational configuration changed.
   Plan 09 is [reviewed/updated](../pending/09-reports-all-branches.md) October 24;
   authorized historical scope, aggregate response/empty states, account integration
   and safe navigation are planned. Technical contracts and runtime/browser proof
   remain gates; no aggregate Reports behavior is implemented.
   Plan 08 is [reviewed/updated](../pending/finance-reconciliation.md) October 24;
   Owner sidebar placement, required-reference default with future-only edits and
   fixed Cash/unique custom names are confirmed. Display bounds and exact reset
   target remain gates. Financial attribution, cutover and cross-plan
   contracts are documented; no feature or database change was implemented.
   Plan 07 is [drafted](../pending/07-controlled-access.md). October 24 decisions:
   protected operator commands, read-only history while organizations are inactive,
   and verified email required for workspace access are confirmed. Provider,
   credential-binding/cutover and inactive-tenant refund exceptions remain gates.
   Plan 06 is [drafted](../pending/06-ci-release-pipeline.md): verification gates and
   controlled release ordering are planned; repository settings, host integration
   and operator approval remain implementation gates. No workflow was changed.
   Plan 05 is [drafted](../pending/05-hosting-session-topology.md), with the October 24
   confirmed same-origin `/api` proxy. Provider selection, spending approval and
   deployment/browser/recovery qualification remain open; no deployment is authorized.
   Plan 04 is [drafted](../pending/04-database-safety.md), with the October 24 confirmed
   targets of at most 15 minutes of lost data and recovery within 2 hours. Restore
   proof remains pending; no database operations are authorized.
   Plan 03 was drafted (now [current](../current.md)): bcrypt's 72-byte new-password
   cap and immediate subsequent-request session revocation are confirmed;
   compatibility/cutover details remain open and implementation is not approved. Plan 02
   is [drafted](02-production-runtime-2026-10-25.md), with startup/logging/readiness
   implementation and operational proof still pending. Plan 01 is
   [drafted](../current.md), with the hint-free design confirmed;
   no fixes have been implemented.
2. Read the exact checklist items, relevant current module documentation, code,
   schema, API contracts and tests. Reuse prior evidence only as dated context;
   cheaply verify source findings and distinguish unverified deployed state.
3. Draft that one plan, or revise the existing specification assigned to that row.
   Do not generate placeholder plans and call them complete. Group related
   checklist actions into a cohesive plan rather than one file per checkbox.
4. Ask about business/security decisions that materially affect scope. Record
   unanswered questions as implementation gates, not implicit assumptions.
5. Check the plan's links, scope, dependencies and checklist coverage. Update its
   README status and next-plan pointer. Report the plan and open questions before
   advancing to the next plan; do not start implementation between planning turns.
6. Once all required plans are drafted, review the complete dependency sequence,
   cross-plan contracts, omissions and decisions. Keep P2 work explicitly optional.
7. Archive this planning-stage document only after the batch review. With explicit
   user approval, promote the next bounded implementation plan to `current.md`.
   Move rather than maintain two active copies, and update README links/status.

### 4. Required contents of each detailed plan

- Priority and release gate: before real pilot data, before paid launch, or P2.
- Goal, observable acceptance conditions, exclusions and checklist items owned.
- Current architecture/evidence, weaknesses and relevant source paths.
- Smallest proposed changes across schema, backend, frontend and operations where
  applicable; name non-applicable layers rather than inventing changes.
- Authentication, RBAC, organization/branch isolation and data-integrity rules.
- Integration contracts and prerequisites, without duplicated ownership.
- Edge cases, historical compatibility, migration/rollback and recovery safety.
- Phased steps with validation commands/evidence, failure handling and stop gates.
- Required updates to module docs after implementation, risks and real questions.

Security, financial calculations, migrations and concurrency need a deep review
during their implementation/review stage. A documentation draft is not that proof.
Do not prescribe new packages/infrastructure before verifying an actual need.

### 5. Coverage and sequencing rules

The README owns the planning manifest and dependency order. The original checklist
remains the release-evidence tracker; leave its checkboxes unchecked until verified.
Its existing six frontend failures, two HTTP assertions and test-source type errors
are dated audit evidence, not a permanent baseline or permission to weaken tests.

Each checklist action has one primary plan owner. Other plans may consume its
contract/evidence, but must not implement the same feature independently. Hosted
cookie topology, proxy trust, readiness and migrations need coordinated contracts
across their owners before any deployment is authorized.

All Branches implementation is deferred until the planning batch finishes, not
cancelled and not certified implemented. Its exact implementation position follows
prerequisite safety gates; its pending status does not allow those to be skipped.

### 6. Completion of this planning stage

- Every required README row has a source-reviewed pending plan and explicit
  acceptance conditions; optional P2 work is clearly distinguished.
- Every checklist action is covered, including testing, hosting upgrade triggers,
  business policies and final sign-off, not just missing application features.
- Existing Payment Accounts and All Branches decisions are retained consistently.
- Unresolved decisions, dependencies, risks and authorization boundaries are visible.
- Relative links resolve and the sequence has no circular prerequisites.
- No product code, dependencies or application data changed during this stage.
- User reviews the batch before any individual implementation phase is promoted.
