# Deployment readiness checklist

Assessment date: October 22, 2026

Status: **Not ready for a live paid launch.** A controlled pilot still needs the
critical security/startup fixes, required features and operational gates below.
This is an audit/checklist, not approval to implement new modules or deploy/reset
databases. Continue using approved current plans for implementation.

Planning sequence: [pending plans and implementation order](plans/pending/README.md).
The active current plan now covers documentation-only planning; feature plans
remain pending/deferred and none of these checklist boxes are certified by it.

## 1. Confirmed rollout and scope

- First stage: free controlled testing with 1–2 organizations, then paid SaaS when
  adoption justifies hosting costs. Do not advertise free infrastructure as reliable
  unattended production POS hosting.
- Required before launch: Payment Account Management/Reporting and Reports All Branches.
- **Merchant settlements and payouts are excluded from this system**, per the latest
  user clarification. They are not launch blockers or an implied future dependency.
- Paid subscriptions will initially use manual collection and controlled activation.
  Automated billing is not a launch requirement; access control still is.
- Hosting is undecided; recommendations and free-tier limits appear in section 8.

Legend: P0 = fix/verify before real pilot transactions; P1 = required before public
paid launch (also before pilot if it is a user-required feature); P2 = optional
refinement. Unchecked boxes are deliberately not certified. Passing local checks
does not establish deployed security, database recovery or rendered correctness.

## 2. Existing modules versus remaining work

| Area                                                         | Repository status                                                                     | Remaining deployment work                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Authentication/account settings                              | Registration/login, rotating sessions, profile/password/account deletion implemented  | Password boundary fix; account recovery/onboarding policy; deployed cookies and rate limits                                     |
| Organizations/branches                                       | Tenant memberships and branch-scoped workflows implemented                            | Controlled pilot enrollment and future manual paid activation/suspension are not an implemented subscription entitlement system |
| Members/invitations                                          | Owner management, branch/merchant access and invitation links implemented             | Real onboarding delivery, revocation and role-change smoke tests; email sending is not present                                  |
| Merchants/branch participation                               | Profiles and affiliations implemented                                                 | Representative real data, access verification; no settlement/payout requirement                                                 |
| Products/inventory                                           | Placements, prices, stock, immutable movements and stock-integrity checks implemented | Full regression, input/empty/loading QA and measured directory scale                                                            |
| POS/Sales                                                    | Atomic completed sale, cash/manual GCash/card, receipts and replay implemented        | Required account configuration feature, printer QA and uncertain-outcome runbook                                                |
| Returns/refunds                                              | Partial/full item returns, manual payout record, restock and history implemented      | Account attribution feature, real role/privacy checks and recovery QA                                                           |
| Reports                                                      | Branch-scoped analytics, Transactions, Daily Data and Rankings implemented            | All Branches deferred plan; dynamic account amounts/toggle pending plan                                                         |
| Spaces                                                       | Catalog/types, assignment/release and occupancy history implemented                   | Verify target migration parity and recent forms/calendar/history regressions                                                    |
| Payment Accounts                                             | Pending proposal, not implemented                                                     | Implement approved account configuration, branch assignment, source snapshots and report aggregation                            |
| All Branches Reports                                         | Deferred planning-only proposal, not implemented                                      | Implement and verify all-role authorized aggregation and detail navigation                                                      |
| Merchant settlements/payouts                                 | Not implemented                                                                       | Explicitly excluded; do not build                                                                                               |
| Automated billing/platform superadmin/general finance ledger | Not implemented                                                                       | Not automatically required. Manual activation needs a narrowly approved control, not an assumed admin platform                  |

Evidence: `PRODUCT.md`, implemented files under `docs/modules/`, Prisma schema,
OrganizationsModule, auth/POS/sales/refunds/reports/spaces components and controllers.
Plans describe proposals, not working modules. UI snapshots and old test counts in
module docs are historical, not a certificate for the current worktree.

## 3. P0: observed release blockers

These are code/build findings, not guesses based on absent documentation.

- [ ] **Fix production startup command.** `backend/package.json` starts
      `node dist/main.js`, but the current build produces `backend/dist/src/main.js`.
      Prove the actual production artifact starts with the documented command. Build
      success alone misses this. Evidence: package script and current dist output.
- [ ] **Keep application error logging enabled in production.**
      `backend/src/config/env.validation.ts` defaults LOG_HTTP_REQUESTS off outside
      development; `config/logging.ts` assigns that value to Pino's global `enabled`.
      Separate optional HTTP request logging from application/error logging and prove
      a production exception is recorded without sensitive data. Reviewer synthetic
      verification confirmed the disabling mechanism.
- [ ] **Resolve bcrypt input truncation.** Registration/password change accept up
      to 128 characters, while current bcrypt hashing has a 72-byte boundary. Reviewer
      synthetic tests confirmed differing suffixes beyond that boundary can match.
      Approve a byte-aware policy or a deliberate compatible hashing transition; test
      Unicode, login, existing accounts and password changes. Do not silently weaken
      validation or make existing users unable to log in.
- [ ] **Configure trusted proxy/rate-limit identity for the selected host.**
      `backend/src/main.ts` does not set proxy trust; the installed throttler uses
      req.ip. Behind a reverse proxy this can bucket all users together. Trust only
      documented proxy hops/networks, reject spoofed forwarded input as appropriate,
      and verify real clients plus login/invitation limits. Default counters are local
      to a process; replica behavior needs evidence, not an unapproved Redis addition.
- [ ] **Distinguish database outages from invalid sessions.**
      `backend/src/modules/auth/auth.guard.ts` catches JWT verification and database
      active-user lookup in one block and converts both to 401. Prove an infrastructure
      outage produces safe service feedback/alerts rather than false session expiry.
- [ ] **Resolve current automated failures** in section 4 without weakening tests
      or making unrelated manual edits disappear. Triage stale expectations separately
      from real bugs, then rerun relevant complete gates.
- [ ] **Verify migration state on the actual target before matching API deployment.**
      A previous development assignment failure showed a NOT NULL mismatch in
      SpaceOccupancy; its timestamp-removal migration exists, but this audit did not
      contact the application database to confirm it is now applied. Validate the whole
      migration history, not just that one migration. Never reset a real store database.

## 4. Fresh local verification evidence

Commands ran against the current local worktree during this audit. No application
database was queried, migrated, reset or seeded by the audit.

| Check                                            | Result                                                                                  | Interpretation                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Backend `npm test -- --runInBand`                | 538/538 tests, 40 suites passed                                                         | Local unit evidence only                                                          |
| Frontend `npm test -- --run`                     | 1,146/1,152 passed; 6 failures                                                          | Release test gate is not green                                                    |
| Backend `npm run test:e2e -- --runInBand`        | 262/264 passed; 2 failures                                                              | HTTP boundary tests, not a real deployed browser/database workflow                |
| Frontend `npm run lint`                          | Passed with 4 unused-code warnings in inventory-placement-form.tsx                      | Review warnings; not zero-warning clean                                           |
| Backend `npm run lint`                           | Passed                                                                                  | Does not fix test type errors                                                     |
| Frontend `npm run build` and `npm run typecheck` | Passed                                                                                  | Build warns about multiple lockfiles/workspace-root inference                     |
| Backend `npm run build`                          | Passed                                                                                  | Production-start path still wrong                                                 |
| Backend `npx tsc --noEmit`                       | Failed in test/spec sources                                                             | Build excludes tests; unit runner does not establish full test-source type safety |
| Backend `npx prisma validate`                    | Passed                                                                                  | Schema syntax/config valid; target database compatibility not proven              |
| Deep review scoped auth/config checks            | Reviewer reports 45/45 focused tests, scoped lint/typecheck and synthetic checks passed | Independent local mechanisms, not deployed proof                                  |
| PostgreSQL integration/concurrency suites        | Not run in this audit                                                                   | Must rerun on a verified disposable database before release                       |
| Browser/device/printer/staging acceptance        | Not run                                                                                 | Historical waivers do not mean tested                                             |
| Dependency advisory/license scan                 | Not run                                                                                 | Must check current production and build dependency risks                          |

### Failure triage checklist

- [ ] `frontend/src/features/pos/model/pos-cart.spec.ts`: over-quantity exception
      wording expects “Only 1”; current code throws “max quantity for Amihan Vase”.
      Focused rerun confirmed the mismatch; still verify validation behavior before
      accepting an assertion update.
- [ ] `frontend/src/shared/components/ui/text-field.spec.tsx`: compact price error
      wording no longer matches expected text. Verify visible and screen-reader feedback.
- [ ] `frontend/src/features/branches/components/branch-workflows.spec.tsx`:
      expected hint text “At least 2 characters.” is absent.
- [ ] `frontend/src/features/inventory/components/inventory-placement-form.spec.tsx`:
      searchable product picker/Enter-selection contract fails. Check real behavior,
      especially branch product availability; do not assume this is only text.
- [ ] `frontend/src/features/reports/components/daily-data-tab.spec.tsx`: assertion
      still expects “PHP -7.00” after currency-prefix refinement.
- [ ] `frontend/src/features/spaces/components/space-management.spec.tsx`: inline
      type creation expects old `md:col-span-2` form geometry.
- [ ] `backend/test/products-inventory.e2e-spec.ts`: two tests retain old default
      limits (10/50) where current defaults are 15. Reconfirm strict query/role behavior.
- [ ] Full backend typecheck: correct test-source drift including auth Request casts,
      obsolete inventory DTO fields, duplicate object keys, generated enum types and
      spaces integration helper/schema types. Do not hide these by excluding more tests.

## 5. P0/P1: required feature completion

- [ ] Enforce staff-only occupancy Released by identity under Plan 20 before real
      pilot use. Omit actor ID/name from Merchant API projections and client
      schemas/views, including nested/current/history responses; retain internal
      attribution and authorized staff visibility. User confirmed October 23.
- [ ] Plan Owner-only space-type rename/archive management under Plan 20, retaining
      references and occupancy history. Review name-based foreign keys/trigger,
      uniqueness, archived selection, historical labels and concurrent edits before
      deciding schema/API changes. Release priority and reactivation policy remain
      open; no deletion or database operations are authorized by this checklist.

- [ ] Extend Plan 18 to durable refund outcome recovery before real refund use,
      confirmed October 23. Recover original frozen command/ID with fresh scoped
      authorization; retrieve completion or explicitly retry unchanged content.
      Never automatically submit, issue money again, duplicate refund records or
      restock twice. Verify response-loss, reload/reopen, cross-tab and concurrency
      cases on a disposable target; keep Plan 10's manual verification fallback.

- [ ] Add bounded POS Load more browsing under Plan 17, preserving authorized
      branch scope, minimal catalog fields, search/eligibility rules and exact-code
      scanner lookup. Define safe continuation, stale-read handling and UI states;
      do not fetch all products or assume table-sized batches. Confirmed October 23.
- [ ] Correct conflicting POS fullscreen descriptions under Plan 15, keeping the
      current branch-name/exit-only header. Existing attempts remain memory-only;
      durable recovery is separately required under Plan 18.
- [ ] Deliver durable checkout outcome recovery under Plan 18 before real checkout
      use, approved for planning October 23. Preserve the frozen original command/
      request ID across reload/reopening with secure scoping and retention rules;
      resolve persisted outcomes and allow explicit same-command retries only.
      No automatic submission, duplicate sale/stock deduction, offline checkout or
      general cart persistence. Define cross-tab, sign-out/access-loss and release
      compatibility behavior, and test lost responses after commit on a disposable
      database. Plan 10 retains manual saved-sales verification/escalation fallback.

- [ ] Align the new inventory placement form's initial threshold to 5 under Plan
      01, preserving explicit 0 opt-out and all existing saved values. Correct
      outdated inventory documentation under Plan 15 without restoring superseded
      controls or prompts. Confirmed October 23; not implemented. Branch-to-branch
      stock transfers remain excluded from this planning batch.

- [ ] Correct Merchant–Branch OpenAPI pagination metadata from 10 to 15 and add a
      regression assertion under Plan 01, approved October 23. Runtime pagination
      already uses 15; do not change behavior to match stale API metadata.

- [ ] **Payment Account Management/Reporting:** resolve remaining policy gates,
      promote an approved implementation phase, then deliver account registry, Cash
      always-enabled/all-branches, configurable reference rules, selected/all branch
      availability, backend enforcement and immutable Sale/Refund account snapshots.
      Source: [pending account plan](plans/pending/finance-reconciliation.md).
- [ ] Deliver dynamic Received/Refunded/Net Received account report, correct actual
      refund-account attribution, exact breakdown table and signed-negative chart.
      Confirm Manager assigned-branch access and historical disabled-account visibility.
- [ ] **Reports All Branches:** implement the [pending plan](plans/pending/09-reports-all-branches.md) after promotion/approval, preserving
      Owner/Manager/Merchant scope, global counts/rankings/pagination, safe source branch
      links and All Time periods. No shared branch-preference sentinel in POS/Inventory.
- [ ] **Controlled enrollment/manual activation:** define the smallest server-side
      control for pilot participants and later manual subscriptions. User confirmed
      October 23 that only the platform operator may provision organizations;
      ordinary users and organization Owners must not bypass this through direct
      APIs. Define secure operator authorization and initial Owner assignment in
      Plan 07, without assuming a full platform-admin module. Current registration
      is not this control. Suspension/reinstatement must preserve history. Approve
      a narrow plan before implementation.
- [ ] Add Owner-only organization renaming to Plan 07, with backend tenant/role
      enforcement, existing name validation and workspace refresh. Keep existing
      organization chooser cards and report-period persistence; correct outdated
      module wording rather than changing those retained behaviors.
- [ ] Plan branch lifecycle enforcement (queue item 16): user selected option 2
      on October 23. Inactive branches should block new operations while history
      remains readable. Define allowed refunds/corrections/closure actions, roles,
      reactivation and in-flight retry semantics before implementation. Current
      behavior is label-only; release priority remains to be confirmed.
- [ ] Implement forgot-password recovery and email verification before the first
      pilot organizations start, as confirmed October 23. Neither workflow nor mail
      delivery is currently implemented. Plan token expiry/single use, abuse protection,
      secure delivery and recovery-session behavior; manual support is not a substitute
      for these required features. Never have support request plaintext passwords.
- [ ] Plan server-side member search and 15-row default pagination (queue item 17),
      with bounded query validation, stable order and page/count metadata. Preserve
      Owner-only tenant access and the current role/branch/merchant rules.
- [ ] Plan member access-change history (queue item 17): record actor, time and
      before/after values for access mutations, with transactional consistency,
      tenant isolation and deliberate retention/visibility rules. No general audit
      platform is implied. Both additions were confirmed October 23; release
      priority remains to be confirmed and neither feature is implemented.
- [ ] Add active-session viewing and selected-session revocation to the planned
      authentication scope. Define what revocation does to existing access JWTs;
      revoking a refresh session alone is not immediate access-token invalidation.
- [ ] Extend Plan 17 with server-side merchant directory pagination, default 15
      rows, preserving existing search/status filters and role-specific access and
      contact visibility. Preserve complete selector workflows when evolving the
      list API. Keep the current merchant creation-modal size; correct conflicting
      documentation wording under Plan 15. Confirmed October 23; not implemented.
- [ ] Improve merchant status confirmations under Plan 11: explain restrictions
      on new sales, products/placements and stock receipts, affected space releases,
      retained history/balances and non-restoration of spaces on reactivation.
      Guidance must match existing eligibility rules, not introduce new restrictions.
      Confirmed October 23; no lifecycle behavior change is authorized.
- [ ] Extend Plan 17 with server-side product directory pagination, default 15
      rows, retaining search, merchant/status filters, stable order and role scope.
      Preserve other list consumers when evolving the API contract. Confirmed
      October 23. Preserve confirmed affiliation-based Manager product visibility,
      including unplaced products; stock/prices remain assigned-branch-only and
      identity management Owner-only. Plan 15 corrects older placement-only wording.
- [ ] Improve product status confirmations under Plan 11: explain that inactive
      products cannot be sold, newly placed or receive stock, while existing prices,
      balances and history remain. Guidance only; do not alter eligibility rules.
      Confirmed October 23; not implemented.
- [ ] Resolve authentication module mismatches through planned behavior changes:
      avoid registration email enumeration, add dedicated password-change/deletion
      rate limits, and use the documented outlined deletion confirmation. These are
      unimplemented requirements, not certification of current security behavior.
- [ ] Plan automatic invitation email delivery with Copy link retained (Plan 07),
      confirmed October 23. Reuse planned mail capability; define provider, failure
      feedback and safe retry semantics. Current delivery is still manual.
- [ ] Require an explicit Accept invitation button (Plan 07); opening a matching
      signed-in invitation link must not automatically create membership. Preserve
      expiry/single-use, matching-account, verification and duplicate-submit guards.
- [ ] Extend Plan 17 with server-side invitation email search, status filtering
      and 15-row default pagination alongside members. Counts, status predicates
      and pages must remain tenant-scoped and consistent at expiry boundaries.
- [ ] Fulfill the earlier removal requirement in Plan 07: permanently delete every
      removed invitation and invalidate its link, including active invitations.
      Preserve existing accepted memberships and their branch grants; define safe
      acceptance/deletion race behavior. Current active removal only revokes.

## 6. P0: deployed security, database and operational gates

### Identity, tenant isolation and privacy

- [ ] Real two-organization/branch smoke tests for guessed IDs, removed members,
      revoked assignments, merchant relinking and inactive historical sources. Frontend
      menu hiding is not an authorization boundary.
- [ ] Verify secure production secrets, rotation procedure, NODE_ENV=production,
      exact HTTPS FRONTEND_ORIGIN and no credentials in NEXT_PUBLIC variables.
- [ ] Verify login, refresh rotation, expired/revoked refresh, logout, deletion and
      password-change revocation on the actual deployed origin pair.
      Distinguish refresh-session revocation from existing access JWT expiry: current
      access tokens can remain usable until expiry after logout/password change
      (15 minutes by default), while deleted-account checks deny subsequent access.
      User confirmed October 23 that Plan 03 must reject revoked-session JWTs on
      subsequent requests immediately, including after password change/reset.
      Implement session-state enforcement and explicit old-token cutover; refresh
      revocation alone does not provide this. Keep bcrypt with a 72-byte UTF-8 cap
      for new/change/reset passwords and define safe existing-login compatibility.
- [ ] Refresh cookies currently use HttpOnly, Secure in production, Path=/auth and
      SameSite=Lax. Unrelated frontend/API provider domains can break refresh despite
      correct CORS. Select a same-site/custom-domain or reviewed same-origin proxy
      topology, or deliberately revise cookie/CSRF policy. Test path/forwarded cookies;
      do not casually enable SameSite=None or wildcard credentialed CORS.
- [ ] Redaction and production exception tests: passwords, authorization/cookies,
      invitation tokens, private command JSON and contact data must not leak. Keep
      SQL parameter logging off. Disable or explicitly protect production Swagger.
- [ ] Run current dependency advisory/license and secret scans; triage severities
      and patches with compatibility tests. This audit did not run a penetration test.

### Data durability and migrations

- [ ] Separate dev/test/pilot/production databases and credentials; runtime pooled
      DATABASE_URL and direct migration DIRECT_DATABASE_URL target the intended schema.
      Use least-privilege runtime access, not migration/admin credentials.
- [ ] Rehearse migrations from the repository-supported baseline; verify existing
      target migration provenance. `docs/development/database-seeding.md` warns against
      deploying the rewritten baseline over a database from an older migration chain.
- [ ] Establish backup frequency, retention/access, recovery-point and recovery-time
      targets; run a restore drill to a separate target and verify sales/refunds/stock.
      A successful backup upload alone is not a tested recovery procedure.
- [ ] Do not use the destructive demo seed in release automation. It truncates tables
      and uses known demo passwords. A prior development reset authorization never
      authorizes resetting a pilot database after real users begin recording activity.
- [ ] Set DB pool/timeout budgets for host memory and database connection limits;
      test cold database wakeups, outages and transaction rollback/retry.

### Release operations

- [ ] Add enforced CI: dependency install, formatting/lint, application and test-source
      typechecks, unit/HTTP suites, disposable integration/concurrency suites and builds.
      No tracked CI/deployment definition was found; platform-side setup is unverified.
- [ ] Pin supported Node/package-manager versions, monorepo root/build paths and
      exact start commands. Verify host PORT binding; frontend currently starts on 3001.
- [ ] Explicit migration-before-app release ordering, API/frontend compatibility,
      release identifier, canary/smoke and rollback runbook. Schema rollback must not
      destroy financial history to restore an old application build.
- [ ] Dependency readiness: current `GET /` returns process status only; add/define
      a meaningful DB/schema readiness gate without public diagnostic leakage.
- [ ] Uptime/error alerts, backup-failure alerts, pool/CPU/memory/bandwidth/DB quota
      monitoring and named incident contact. Verify real alerts rather than assuming
      provider dashboards are watched.
- [ ] Document support actions for unknown checkout/refund outcomes: check saved
      records and retry only the same frozen command where valid; never collect twice.
      Attempt state is in memory and can be lost on full refresh/tab close.
- [ ] Document a store fallback during internet/provider outages. There is no offline
      POS capability; do not promise offline selling or automated resynchronization.

## 7. P0/P1: end-user acceptance and P2 refinements

- [ ] Implement scoped route-level error/not-found recovery under Plan 11,
      approved for planning October 23. Preserve unknown checkout/refund recovery,
      keep retries read-only unless explicitly retrying the same frozen command,
      and revalidate access without exposing private diagnostics. Coordinate
      boundary placement/remount tests with Plan 18; no automatic mutation retries.
- [ ] Consolidate the Frontend Experience current-behavior reference under Plan
      15, separating obsolete layouts/defaults and historical delivery evidence
      while preserving current UI and actual QA limitations. Approved October 23.

- [ ] Correct conflicting Spaces focus/layout/row-style documentation under Plan
      15, retaining current UI as confirmed October 23. Do not confuse source/
      frontend checks with unrun PostgreSQL overlap or concurrency tests.

- [ ] Plan scoped CSV exports for Reports Transactions, Daily Data and Rankings
      (19), approved for planning October 23. Preserve applied filters/date/sort and
      fresh role/tenant/branch scope, export full matching results with explicit
      resource limits/no silent truncation, and test exact values, formula-injection
      protection and CSV escaping. Coordinate with 08/09. Optional feature; release
      priority remains unconfirmed, not an automatic pilot blocker.
- [ ] Correct outdated Reports summary-only frontend/date-limit documentation
      under Plan 15 while retaining current analytics and bounded long-history
      behavior. No reporting behavior change is implied.

- [ ] Correct outdated refund documentation under Plan 15: forms are implemented
      and Reports opens the shared refund detail modal in place. Preserve current
      behavior; no new refund edit/delete or payout feature is requested.

- [ ] Correct the older Sales API page-default documentation from 50 to 15 under
      Plan 15, preserving existing runtime behavior and immutable-sale history.
      User approved October 23; no sale edit/delete feature is requested.

- [ ] Full workflow: onboard two organizations; create branches, invite each role,
      assign merchant access; create/place products; receive/adjust/price/threshold stock;
      scan/search checkout; print/view receipt; partial refund/restock; review reports;
      create/assign/release spaces and view occupancy history.
- [ ] Cash/manual account validation, stale price/stock conflicts, duplicate activation,
      same-ID retry, failed response after commit, branch navigation guards and refresh
      recovery. Use realistic barcodes, reference strings and money values.
- [ ] Receipt printing on intended printer/browser/paper size; reprint never repeats
      checkout. Existing receipts are internal records, not fiscal/tax invoices. Confirm
      the intended business's invoicing requirements with qualified local advice rather
      than marketing unimplemented tax compliance.
- [ ] Keyboard-only, focus return, dialogs/popovers/calendar positioning, 320px layout,
      200% zoom, reduced motion, table scrolling/pagination, disabled states, accessible
      contrast and non-color-only indicators. Review recent UI changes, not only old screens.
- [ ] Slow/offline/error/empty/loading tests; search input remains usable during
      skeleton loading, selectors/headers do not jump, obsolete requests do not repopulate
      another role's data. Prevent unhandled runtime errors from stranding a cashier.
- [ ] Deliver approved route-level error/not-found/retry handling under Plan 11: no app `error.tsx` or custom
      `not-found.tsx` boundary was found. Existing RequestError components are not proof
      that all render exceptions recover gracefully.
- [ ] Performance tests at realistic product/merchant/branch/history volume. Some
      directory APIs still return unpaginated data; measure before deciding bounded
      pagination changes. Avoid speculative caching or new infrastructure.
- [ ] Privacy notice, service terms, support/contact process, retention/export/deletion
      policy, tenant offboarding and operational ownership accepted before collecting
      real personal/business data. Compliance is not established by this code audit.
- [ ] P2: finish docs index/current-behavior cleanup, coherent hints/errors, remaining
      visual inconsistencies and lockfile-root warning. Prioritize reliability over new
      themes, decorative animations, broad generic table/modal rewrites or extra modules.

## 8. Hosting recommendation for the 1–2 organization pilot

Provider facts checked October 22, 2026. Quotas/prices can change; recheck the linked
official pages before creating services. No provider or domain was provisioned.

### Free test setup: Render frontend/API + Neon PostgreSQL

Use two Render Node web services for the existing full Next.js frontend and NestJS
API, plus a separate Neon Free PostgreSQL project. This minimizes framework changes;
the current frontend is not a static export. Render documents server-side Next.js
as a web service. [Render Next.js deployment](https://render.com/docs/deploy-nextjs-app)

This is **testing only**, not the recommendation for unattended store operations.
Render warns against free instances for production: services sleep after 15 minutes,
may take about a minute to wake, and share 750 free instance-hours per workspace.
Two services running continuously exceed that shared monthly allowance. Free Render
Postgres expires after 30 days, so do not use it for durable store records.
[Render free limits](https://render.com/docs/free)

Neon Free currently lists 100 CU-hours/month and 1 GB storage per project, with a
limited restore window. Its pricing guidance positions Free for development and
prototyping rather than production guarantees. Use separate backups, watch quotas
and test cold starts; do not treat the free restore window as the recovery plan.
[Neon plans and limits](https://neon.com/pricing)

The deployment must solve the session-cookie origin topology described in section 6.
Free provider hostnames are not automatically a valid same-site session design.
A reviewed same-origin proxy can avoid a new custom-domain expense, but it is an
implementation decision requiring browser-facing cookie paths, tests and a plan;
it does not exist merely because Next.js supports proxying. Never weaken cookie
security just to make the free setup work. If external requests stay under `/auth`,
the current path can remain; if a proxy exposes another prefix, deliberately map
cookie Path on issuance and clearing so both refresh and logout work. Preserve
HttpOnly/Secure and the reviewed SameSite/CSRF protections.

### When charging or relying on daily checkout

Budget for always-on compute and durable database recovery before scaling or
making availability promises. Candidate: upgrade Render frontend/API compute and
choose an appropriate managed database tier; price both services, storage, bandwidth,
backups, domain and any email delivery together. Render currently advertises a $7
starting web-service compute tier, so two such instances are approximately $14/month
compute only, subject to memory/load checks and current workspace/usage terms.
[Render pricing](https://render.com/pricing)

Alternative: Railway can host both Node apps; Hobby has a $5 minimum including $5
usage, **not a $5 flat bill for both services**. Pro has a $20 minimum and is the
provider's production-oriented recommendation. Measure actual memory/CPU/egress
before selecting it. [Railway pricing](https://railway.com/pricing),
[Railway pricing FAQs](https://docs.railway.com/pricing/faqs)

Do not choose Vercel Hobby for a commercial launch: it is restricted to personal,
non-commercial use. A future Vercel deployment needs the appropriate commercial
plan; do not assume the app being free to pilot users settles the commercial-use
question. [Vercel Hobby restrictions](https://vercel.com/docs/plans/hobby)

Upgrade trigger checklist:

- [ ] Before the app becomes the sole live checkout record or uptime is promised.
- [ ] Before collecting SaaS fees/public commercial launch without reviewed plan terms.
- [ ] Before free compute/storage/egress limits or restore limits endanger data/access.
- [ ] After measuring memory: a small paid instance is not automatically adequate
      for both Next.js builds/runtime and NestJS. No cost here is a guaranteed total bill.

## 9. Suggested order and release sign-off

1. Fix P0 startup/logging/password/proxy/auth-error issues under an approved plan;
   clean up failing tests and establish CI.
2. Implement the user-required Payment Accounts and All Branches proposals in
   approved bounded phases. Do not add settlements/payouts.
3. Define controlled pilot enrollment/manual activation and recovery support.
4. Rehearse migrations/backups on disposable infrastructure and choose tested host/
   cookie topology. Deploy an empty/non-sensitive staging dataset first.
5. Run complete workflow, integration/race, browser/printer and restored-data checks.
6. Allow only the agreed 1–2 organizations into the pilot with explicit limits,
   backup/operator responsibilities, a fallback and incident contact.
7. Before charging, close paid-launch operational/legal/support gates and upgrade
   infrastructure as required by the measured workload and provider terms.

- [ ] Product Owner accepts required feature scope and exclusions.
- [ ] Engineering signs off green agreed automated gates and no unresolved critical risks.
- [ ] Operations demonstrates deploy/start/migrate/restore/rollback/alert procedures.
- [ ] Pilot users complete representative checkout/refund/inventory/space workflows.
- [ ] Hosting terms, limits and budget are accepted; backups and support have named owners.
- [ ] Sign-off record includes release commit, environment, date, evidence links and
      explicit exceptions/expiry. No unchecked P0 item is silently waived by a successful build.

Audit scope: risk-based repository review, fresh local checks and one independent
deep security/operations review. Not an exhaustive penetration test, legal opinion,
live database audit, load test or deployed/browser acceptance. No product fixes
or application database operations were performed. Existing worktree edits remain.
