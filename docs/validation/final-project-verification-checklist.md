# Final project verification checklist

Date opened: 2026-11-09
Candidate commit: ______________________________
Verification owner: _____________________________
Engineering reviewer: ___________________________
Operator/business approver: _____________________
Environment/provider/region: ____________________
Decision: `NO-GO` / `STAGING ONLY` / `BOUNDED PILOT APPROVED`

This is the current-candidate verification checklist for Plans 01–20 and Plan
14 release sign-off. It is an evidence record, not deployment permission. A
checkbox may be marked only when the exact candidate, environment and evidence
are recorded beside it. `Not run` is not `Pass`; a deferred item remains open.

The checklist deliberately separates local, disposable PostgreSQL, hosted,
browser/PDF, security/load, recovery and policy evidence. Historical test counts
may be linked as supporting evidence only when the candidate and scope still
match. Never put credentials, tokens, full backups, private exports or customer
data in this file or Git.

## Current automated run — 2026-11-09

This is a current local run against the working tree. It is evidence, not final
release approval. The repository CI runner stopped before executing because the
host has Node `24.12.0` while `.node-version` requires `20.19.4`. Individual
compatible checks were then run directly.

- **PASS:** backend formatting check.
- **PASS:** backend lint.
- **PASS:** backend Prisma validation and client generation.
- **PASS:** backend typecheck.
- **PASS:** backend build.
- **PASS:** backend unit tests, 53 suites / 638 tests.
- **PASS with warnings:** frontend formatting, typecheck and production build.
- **PASS with warnings:** frontend lint; 7 warnings, 0 errors, including unused
  inventory values and two Spaces effect-dependency warnings.
- **PASS:** frontend tests, 125 files / 1,223 tests.
- **PASS:** configured development Neon migration status, read-only; 23
  migrations found and schema current.
- **BLOCKED:** official `npm run ci -- --skip-install`; required Node
  `20.19.4` is not installed on this host.
- **BLOCKED:** PostgreSQL HTTP/e2e, integration, migration-rehearsal and runtime
  suites; Docker Desktop is not running and no disposable database was started.
- **NOT RUN:** hosted provider, browser/device/PDF/printer, mailbox, backup/
  restore, load, dependency/license/secret scan and policy/approval checks.

Automated evidence owner/date: Codex / 2026-11-09. Before a final decision,
rerun the official CI packet on Node `20.19.4` with Docker available, then attach
the disposable PostgreSQL and runtime artifacts. Do not use configured Neon as a
test target for destructive integration suites.

## 0. Safety and candidate identity

- [ ] Confirm the candidate commit is exact, clean, reproducible and contains
      the intended frontend, backend, migrations, scripts and documentation.
- [ ] Record the frontend build ID, backend build ID, Prisma migration checksum
      set, Node version, package-manager version and lockfile hash.
- [ ] Record the exact environment, region, provider resources, domains and
      configuration version. Do not paste secret values.
- [ ] Confirm the target is disposable, staging or explicitly approved pilot;
      never use demo reset/seed against a shared or production database.
- [ ] Confirm `DATABASE_URL` uses the runtime least-privilege account and
      `DIRECT_DATABASE_URL` is reserved for reviewed migration operations.
- [ ] Confirm no unreviewed migration, seed, dependency, environment, DNS,
      secret, proxy or infrastructure change is bundled with the candidate.
- [ ] Record the release owner, rollback owner, support owner and approver.

Suggested local checks from the repository root:

```bash
git status --short
git rev-parse HEAD
git diff --check HEAD^ HEAD

cd backend
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build

cd ../frontend
npm run typecheck
npm run lint
npm run build
```

## Whole-project surface inventory

Plans are delivery units, not the complete product boundary. Before signing off,
walk this inventory and link each item to a test, manual scenario, module doc or
explicit exclusion. Archived plans are historical; current behavior is defined
by the implementation and `docs/modules/`.

### Backend and platform surfaces

- [ ] Health, readiness, graceful shutdown and runtime configuration.
- [ ] Authentication, registration, login, refresh sessions, logout, password
      reset/change, email verification and account deletion.
- [ ] Organization authorization context, active organization state, role guards,
      tenant isolation and inactive-organization behavior.
- [ ] Organization profile and switcher behavior.
- [ ] Branch creation, editing, lifecycle, assignment and branch-scoped access.
- [ ] Membership directory, role changes, merchant linking, branch grants,
      removal safeguards and access history.
- [ ] Invitations, delivery, resend, acceptance, expiry, revocation and removal.
- [ ] Merchant profiles and merchant lifecycle states.
- [ ] Merchant–branch participation and eligibility rules.
- [ ] Products, product status, merchant association, barcode/SKU and catalog
      visibility.
- [ ] Branch inventory, placements, prices, thresholds, receiving, corrections,
      movements and stock integrity.
- [ ] POS browsing, search, exact-code lookup, cart, pricing, stock conflicts,
      payment selection and checkout.
- [ ] Sales persistence, receipt/detail/replay, reporting scope and immutable
      snapshots.
- [ ] Refund command, refund items, payout account, restocking, movement history,
      refund detail and idempotent replay.
- [ ] Durable checkout/refund command recovery and unknown-outcome handling.
- [ ] Payment accounts, branch assignment, references, Cash invariants and
      account-based reports.
- [ ] Reports overview, Transactions, Daily Data, Rankings, All Branches and
      merchant own-only projections.
- [ ] Spaces, space types, assignment, release, occupancy history and Merchant
      actor privacy.
- [ ] DTO validation/whitelisting, OpenAPI response contracts, exception filters,
      logging redaction, throttling, CORS, Helmet and request limits.
- [ ] Prisma schema, migrations, constraints, triggers, indexes, seed safety,
      generated client and database connection/pool behavior.
- [ ] Email delivery, provider failure handling, templates and token handling.
- [ ] Operator commands, migration preflight, deployment scripts and runtime
      diagnostics.

### Frontend and user-facing surfaces

- [ ] Public landing/root, login, registration, verification, password recovery
      and account settings routes.
- [ ] Auth/session refresh, logout, access-loss, inactive-organization and
      unauthorized/not-found/error route behavior.
- [ ] Application shell, organization switcher, branch selection, navigation,
      pending state, notices, dialogs, responsive chrome and theme/palette.
- [ ] Organization and branch management.
- [ ] Member and invitation management, access editing, merchant linking and
      access-history UI.
- [ ] Merchant profiles and merchant–branch participation.
- [ ] Product directory, product forms, search/status filters and merchant
      selectors.
- [ ] Inventory directory, placement forms, stock receiving/correction,
      movement/history views and opening-stock flows.
- [ ] POS browse/search, Load more, scanner lookup, cart, checkout confirmation,
      payment account selection, stale-state errors and saved receipts.
- [ ] Sales history, sale detail, receipt/replay and scoped merchant views.
- [ ] Refund forms, item selection, payout account selection, restocking,
      refund detail and recovery/error states.
- [ ] Payment-account management, branch assignment picker and selector behavior.
- [ ] Reports filters, period calendar, branch scope, tabs, charts, tables,
      source links, account toggles and merchant projections.
- [ ] Spaces workspace, Types tab, type creator, space forms, occupancy detail,
      assignment/release dialogs and history.
- [ ] Command-recovery UI, loading/retry/unknown states and safe action wording.
- [ ] Shared inputs, buttons, dropdowns, comboboxes, tables, pagination,
      skeletons, empty states, notices, confirmation dialogs and error displays.
- [ ] Brand assets, typography, colors, focus states, reduced-motion behavior,
      print/PDF surfaces and responsive layout rules in `DESIGN.md`.

### Repository and delivery surfaces

- [ ] `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, README files and module docs match
      current behavior and do not promise excluded capabilities.
- [ ] API/OpenAPI documentation matches runtime routes, authorization and response
      variants.
- [ ] Development migration, seeding, CI and operational runbooks are safe for
      their stated target and never imply a production reset path.
- [ ] Validation records link to current candidates and distinguish historical,
      local, disposable, hosted and manual evidence.
- [ ] Git ignores, lockfiles, generated artifacts, build output, environment
      files and secrets are correctly handled.
- [ ] No untracked source, accidental debug route, test credential, private
      export, temporary dump or local-only dependency is in the candidate.

### Explicit project exclusions to re-confirm

- [ ] Merchant settlements, payouts/ledger and provider-balance reconciliation
      remain excluded.
- [ ] Automated billing/subscriptions and platform-superadmin features remain
      excluded unless separately approved.
- [ ] Offline POS and automatic offline resynchronization remain excluded.
- [ ] Physical printer/tax-invoice qualification is either completed or clearly
      deferred; receipts are not represented as fiscal invoices.
- [ ] No Redis, queue, event-streaming, microservice, separate tenant database,
      global audit platform or generic catalog abstraction was introduced without
      approval.

## Whole-project test inventory

Run the complete applicable suite for the frozen candidate. Record the exact
command, result, duration, test count, skipped count and artifact link. A focused
test is supplemental; it does not replace the corresponding full suite.

- [ ] Backend unit tests: services, guards, DTOs, auth, sessions, authorization,
      organizations, branches, memberships, invitations, merchants, products,
      inventory, POS, sales, refunds, reports, payment accounts, recovery and
      spaces.
- [ ] Backend mocked HTTP/controller tests: status codes, validation,
      whitelisting, response shapes, role boundaries and exception mapping.
- [ ] Backend HTTP/e2e tests: real request pipelines, cookies, auth/session
      behavior, organization context, tenant isolation and route contracts.
- [ ] Backend PostgreSQL integration tests: migrations, constraints, triggers,
      indexes, foreign keys, transactions, tenant joins, history, idempotency,
      concurrency and rollback behavior.
- [ ] Database migration rehearsal: clean baseline, upgrade path, existing data
      preservation, failure recovery and migration preflight.
- [ ] Runtime smoke tests: built production process, port binding, health/live,
      health/ready, proxy behavior, dependency failure and graceful shutdown.
- [ ] Frontend component/model/API tests for every feature and shared component,
      including schemas, request normalization and error handling.
- [ ] Frontend route/workspace tests: auth, shell, organization/branch context,
      navigation guards, stale response protection and role-based visibility.
- [ ] Frontend full Vitest suite with no unexplained skips or snapshot drift.
- [ ] Frontend/backend lint, formatting and application/test-source typechecks.
- [ ] Frontend/backend production builds from a clean install with the supported
      Node/package-manager versions.
- [ ] Browser/device manual QA for critical workflows, accessibility, responsive
      behavior, PDF/print and real origin/session cookies.
- [ ] Dependency advisory, license, secret and built-artifact scans.
- [ ] Performance/load/concurrency tests using representative organization,
      product, history, POS, report and five-staff workloads.
- [ ] Operational drills for backup restore, outage, alert delivery, unknown
      transaction recovery, migration failure and rollback/no-go decisions.

Test inventory record:

```text
Backend unit:       _____________________________________________
Backend HTTP/e2e:   _____________________________________________
PostgreSQL:         _____________________________________________
Migration/recovery: _____________________________________________
Runtime:            _____________________________________________
Frontend:           _____________________________________________
Browser/manual:     _____________________________________________
Security/scans:     _____________________________________________
Performance/races:  _____________________________________________
Operations drills:  _____________________________________________
```

## 1. Plan 01 — regression baseline and test contracts

- [ ] Backend unit suites pass with no hidden, disabled or excluded mandatory
      tests.
- [ ] Backend HTTP/e2e suites pass with current DTO validation, authorization,
      error codes and response shapes.
- [ ] Frontend tests pass with current user-facing text, loading/error states,
      route guards and form behavior.
- [ ] All application and test-source typechecks pass.
- [ ] Formatting, linting, Prisma validation/generation and production builds
      pass.
- [ ] Disposable PostgreSQL integration and concurrency suites pass on the
      exact candidate.
- [ ] Every failure is classified as fixed, accepted with owner/expiry, or a
      release blocker; no assertion is weakened to make the run green.

Record commands, counts, skipped tests and evidence links:

```text
Backend:       _________________________________________________
Frontend:      _________________________________________________
Integration:   _________________________________________________
Build/artifact:_________________________________________________
Failures/open issues: __________________________________________
```

## 2. Plan 02 — production runtime, logging and readiness

- [ ] Fresh production build starts with the documented command and binds the
      provider-assigned `PORT`.
- [ ] `/health/live` remains process-only and returns the expected no-cache
      response.
- [ ] `/health/ready` reports bounded database readiness and returns 503 during
      dependency failure, then recovers without a business-data write.
- [ ] Graceful shutdown drains traffic, closes database resources and does not
      strand in-flight financial operations.
- [ ] Helmet, CORS, request throttling and body/request limits match the chosen
      host topology.
- [ ] Production logs contain request IDs and useful severity while redacting
      passwords, cookies, authorization, tokens, private JSON, contact data and
      SQL parameters.
- [ ] Generic client errors do not expose stack traces, SQL, credentials or
      tenant-private details.
- [ ] Production Swagger/OpenAPI exposure is disabled or explicitly protected.
- [ ] Cold start, database wake-up, timeout and dependency-outage behavior is
      recorded with response codes and operator action.

## 3. Plan 03 — authentication and request-boundary hardening

- [ ] Registration validates and normalizes input, enforces password policy and
      does not reveal whether an email already exists.
- [ ] Login succeeds for a valid verified account and returns safe 401/403/503
      distinctions for invalid credentials, unverified accounts and database
      failure.
- [ ] Access tokens are short-lived, bound to active sessions and rejected
      after logout, revocation, deletion or session invalidation.
- [ ] Refresh rotates correctly, rejects replayed/expired/revoked sessions and
      clears the correct cookie on logout.
- [ ] Production cookies are HttpOnly, Secure, correct Path, reviewed SameSite
      and scoped to the actual same-origin/proxy topology.
- [ ] Origin/CSRF behavior is tested from the real frontend/API origin pair;
      forged forwarded headers cannot bypass rate-limit identity.
- [ ] Login, refresh, password reset, password change, deletion and invitation
      endpoints have appropriate abuse throttles and safe cooldown behavior.
- [ ] Password reset tokens are single-use, expire, are stored/handled safely,
      and invalidate affected sessions according to policy.
- [ ] Account deletion and anonymization preserve required tenant/history rules
      without leaving active access.
- [ ] Unknown DTO fields are rejected and client-supplied tenant, role, actor,
      price, total and authorization values are never trusted.

## 4. Plan 04 — database migration, isolation and recovery safety

- [ ] Run read-only migration preflight against the exact target and record
      `empty`, `current` or `upgrade-needed`; `unsafe` blocks the release.
- [ ] Confirm every repository migration is applied in order with matching
      checksum and no unresolved failed/rolled-back attempt.
- [ ] Rehearse the full migration chain from the supported baseline on a
      disposable PostgreSQL target.
- [ ] Confirm migration-before-application ordering and compatible API/client
      rollout behavior.
- [ ] Verify runtime/migration credentials are separated and least-privileged.
- [ ] Confirm backup schedule, retention, accessibility, encryption and alerting
      meet the approved policy.
- [ ] Restore a recent backup to a separate target without overwriting current
      writes.
- [ ] Validate restored sales, refunds, stock balances/movements, memberships,
      sessions, invitations, payment snapshots and tenant constraints.
- [ ] Measure and record RPO no worse than 15 minutes and safe RTO no worse than
      2 hours, including application reconnection.
- [ ] Test pool exhaustion, timeout, cold database wake-up, transaction
      rollback and retry behavior.
- [ ] Prove no demo reset/seed, broad truncate, financial rewrite or old-schema
      rollback is used in release operations.

Migration evidence:

```text
Target identity: ________________________________________________
Preflight result: _______________________________________________
Migration set/checksum: _________________________________________
Backup timestamp: _______________________________________________
Restore target/evidence: ________________________________________
Measured RPO/RTO: ______________________________________________
```

## 5. Plan 05 — hosting and secure session topology

- [ ] Record the approved provider, plan, region, terms, limits, cost ceiling
      and resource ownership.
- [ ] Confirm frontend, API, database and email services are separated and use
      the intended runtime/build commands.
- [ ] Confirm same-origin `/api` routing, forwarded headers, trusted proxy
      boundaries, CORS and rate-limit identity with real requests.
- [ ] Verify refresh cookies, logout, redirects, deep links and origin checks on
      the deployed frontend/API pair.
- [ ] Confirm production secrets are injected securely, rotated and absent from
      client bundles, logs, artifacts and `NEXT_PUBLIC_*` variables.
- [ ] Confirm host ports, health checks, timeouts, memory/CPU limits and cold
      starts are within measured budgets.
- [ ] Rehearse migration-before-app deployment and a compatible rollback.
- [ ] Confirm DNS, TLS, certificate renewal, email sender/domain and provider
      account recovery ownership.
- [ ] Record provider limitations that prevent production claims or require a
      controlled pilot boundary.

## 6. Plan 06 — CI and repeatable release pipeline

- [ ] Pull-request CI runs on the supported Node/package-manager versions.
- [ ] CI runs install, formatting, lint, application/test-source typechecks,
      unit/HTTP tests, disposable PostgreSQL integration/concurrency tests and
      frontend/backend builds.
- [ ] CI uses synthetic credentials and isolated service containers only; no
      live database, email, deployment or demo seed is reachable.
- [ ] CI artifacts and logs exclude secrets, tokens, customer data and full
      database dumps.
- [ ] Required checks are enforced on the protected branch.
- [ ] A hosted pull request run passes on the exact candidate.
- [ ] Release workflow identifies one immutable commit and prevents deploying
      an unverified or dirty worktree.
- [ ] Migration job ordering, approval, failure handling and rollback ownership
      are documented.
- [ ] Failed release, canceled job, partial deployment and stale artifact paths
      have tested stop behavior.

## 7. Plan 07 — controlled enrollment, activation and account recovery

- [ ] Operator-only organization provisioning requires the intended identity,
      host restriction and explicit command confirmation.
- [ ] New organizations start inactive and cannot bypass activation through a
      user-facing or direct API path.
- [ ] Only authorized operators activate/deactivate organizations; inactive
      organizations reject new writes while permitted history behavior matches
      policy.
- [ ] Owner creation requires a verified account and enforces last-Owner rules.
- [ ] Email verification works with real delivery, expiry, single-use tokens,
      resend cooldown and safe error disclosure.
- [ ] Password recovery works through a controlled mailbox, invalidates/reviews
      sessions correctly and never sends or requests plaintext passwords.
- [ ] Invitation creation, delivery, resend, acceptance, expiry, duplicate
      submit, matching account and permanent removal behave correctly.
- [ ] Invitation branch grants are applied atomically and cannot cross tenants.
- [ ] Organization rename, membership role changes, merchant linking and branch
      assignments enforce Owner-only and object-level authorization.
- [ ] Manual verified Owner offboarding and tenant-scoped handover are tested.

## 8. Plan 08 — payment accounts and reports

- [ ] Each organization has exactly one immutable, enabled, all-branch Cash
      account.
- [ ] Custom account names, reference policies, enable/disable behavior and
      selected/all-branch assignment enforce tenant and branch scope.
- [ ] Cash cannot be renamed, reassigned or deleted; disabled custom accounts
      cannot be used for new completion but remain readable in authorized history.
- [ ] Checkout revalidates account authorization, branch assignment, reference
      policy, totals and stock inside the transaction.
- [ ] Sale snapshots preserve account ID/name/cash/reference policy and remain
      unchanged after account edits.
- [ ] Refunds attribute to the actual payout account, independently of the
      original sale account.
- [ ] Duplicate request IDs replay the exact completed response without a second
      sale, refund, movement or account aggregate.
- [ ] Concurrent account update/completion races fail safely without partial
      writes.
- [ ] Reports show exact Received, Refunded and Net Received amounts, counts,
      account grouping, disabled historical accounts and authorized branch scope.
- [ ] Merchant reports omit other-merchant payment/account data.
- [ ] The configured development Neon recovery proof remains attached: three
      sales and one refund preserved, exact totals retained and snapshots complete.

## 9. Plan 09 — Reports All Branches

- [ ] Owner All Branches scope aggregates every authorized branch exactly once.
- [ ] Manager scope includes only assigned branches and never exposes hidden
      branch names, counts, totals or rankings through filters/pagination.
- [ ] Merchant scope remains own-item-only and does not expose organization-wide
      payment, actor or other-merchant data.
- [ ] Overview, Transactions, Daily Data and Rankings use the same authorized
      branch/date/filter scope.
- [ ] All Time and Manila-calendar date boundaries are exact and stable across
      timezone changes.
- [ ] Counts, totals, pagination, empty states and branch/source links remain
      correct for zero, one, many and mixed-branch data.
- [ ] Source sale/refund navigation cannot escape the organization or use an
      All-branches sentinel as a real branch ID.
- [ ] The known 390px selector/calendar overflow is either fixed and rechecked or
      recorded as an explicit accepted deferral; it is not silently called pass.

## 10. Plan 10 — monitoring, recovery and outage operations

- [ ] Live/ready checks, application errors, database failures, backup failures,
      pool pressure, CPU/memory, bandwidth and quota alerts reach a named owner.
- [ ] Alert thresholds, severity, escalation path and quiet-hours behavior are
      documented and tested.
- [ ] Unknown checkout/refund outcome runbook checks persisted records before
      retrying the same frozen command; it never collects twice.
- [ ] Internet/provider/database outage procedure stops affected collection and
      provides safe operator guidance; no offline resync is implied.
- [ ] Backup failure, restore failure, migration failure and stuck deployment
      procedures identify who pauses writes and who approves recovery.
- [ ] Incident contact, coverage hours, support channel and two-hour recovery
      expectation are explicit; no 24/7 promise is implied.
- [ ] Post-incident evidence retention and customer communication boundaries are
      documented without exposing private data.

## 11. Plan 11 — end-to-end workflow, accessibility and receipts

Use at least two organizations, two branches, Owner, Manager, Cashier and
Merchant accounts. Repeat key flows after refresh, sign-out/sign-in and access
changes.

- [ ] Onboard organization, verify email, activate, invite roles and accept an
      invitation.
- [ ] Create branches, merchant affiliations, products, placements and stock;
      verify inactive/archived restrictions and readable history.
- [ ] Complete Cash, GCash and Card checkout with exact decimal totals,
      references, stale-price/stock conflict and duplicate-submit protection.
- [ ] View, reload and reprint receipts; reprint never repeats checkout or stock
      deduction.
- [ ] Complete partial/full refunds, payout account attribution, restock and
      historical detail.
- [ ] Exercise response-loss/reload/reopen/recovery routes without automatic
      duplicate mutation.
- [ ] Verify route-level error/not-found/retry boundaries recover without
      exposing private diagnostics or stranding the workflow.
- [ ] Verify saved receipt/PDF content, print layout and stated printer/tax
      limitations. Physical printer qualification may remain explicitly deferred.
- [ ] Keyboard-only navigation covers menus, tabs, dialogs, comboboxes, tables,
      calendars, pagination and confirmation actions.
- [ ] Focus moves into dialogs, returns to the trigger, survives error states and
      does not become trapped behind overlays.
- [ ] Check 320px/390px/768px/desktop widths, landscape, 200% zoom and reduced
      motion.
- [ ] Verify labels, descriptions, errors, live regions, contrast, focus rings,
      disabled states and non-color-only status indicators with a screen reader
      or accessibility inspection tool.
- [ ] Check slow network, offline, timeout, empty, loading, retry and stale
      response states on every critical workflow.

## 12. Plan 12 — performance, dependency and security qualification

- [ ] Define the five-staff mixed workload and execute it on the actual candidate
      host or an equivalent approved target.
- [ ] Record p50/p95 latency, error rate, throughput, memory, CPU, database
      connections, query duration, cold start and build time.
- [ ] Measure large organizations: members, invitations, merchants, products,
      branches, sales, refunds, occupancy history and reports.
- [ ] Confirm every paginated/search endpoint bounds rows, counts and sort work;
      no hidden first-page truncation or unbounded option fetch remains.
- [ ] Run dependency advisory/license scans and classify every finding.
- [ ] Run secret scanning against source, history, CI logs and built artifacts.
- [ ] Perform focused security review of authentication, tenant isolation,
      object authorization, input validation, rate limits, logs, cookies, CORS,
      file/PDF/CSV output and financial invariants.
- [ ] Review concurrency for checkout/refund, account configuration, branch
      lifecycle, membership/access history, spaces and recovery commands.
- [ ] Resolve every critical/high issue or document an explicitly approved
      bounded exception with owner, mitigation and expiry.

## 13. Plan 13 — privacy, support and commercial readiness

- [ ] Identify the operating business, responsible contact and support channel.
- [ ] Approve privacy notice, service terms, retention, export, deletion,
      anonymization, tenant offboarding and incident communication policies.
- [ ] Decide retention/redaction for member access history and actor identities.
- [ ] Confirm data processor/provider terms, email terms, database backup terms,
      hosting terms and intended commercial use.
- [ ] Define manual activation, fee collection, cancellation, suspension and
      handover; automated billing remains excluded unless separately approved.
- [ ] Confirm no tax-invoice, settlement, provider-balance or compliance claim is
      made beyond the implemented behavior.
- [ ] Record legal/privacy/commercial review owner and date. A technical pass is
      not compliance approval.

## 14. Plan 14 — release sign-off packet and decision

- [ ] Freeze one candidate commit and update the packet with exact artifact,
      schema, environment and configuration identity.
- [ ] Link each Plan 01–20 gate to dated evidence, owner and status.
- [ ] Mark every item `PASS`, `FAIL`, `DEFERRED`, or `NOT RUN`; never convert
      missing proof into pass because the code exists.
- [ ] Record included features, role/branch scope, organization/staff limits,
      support coverage, recovery limits and excluded capabilities.
- [ ] Record accepted exceptions with impact, mitigation, owner, expiry/trigger
      and explicit approver.
- [ ] Rehearse a failed gate, no-go decision, stop-on-incident and rollback
      decision in staging.
- [ ] Confirm no secrets, backups, tokens, tenant exports or private customer
      data are in the packet or Git.
- [ ] Obtain named engineering, operator and business decisions.
- [ ] Choose exactly one decision: `NO-GO`, `STAGING ONLY`, or `BOUNDED PILOT
      APPROVED`. Paid launch is a separate later decision.
- [ ] Update `docs/plans/current.md`, the queue, module docs and the validation
      packet so statuses do not contradict one another.

## 15. Plan 15 — optional interface and documentation refinements

Plan 15 is nonblocking and not approved by default.

- [ ] Explicitly defer Plan 15 and record that no implementation is required; or
- [ ] Approve its exact scope before editing code.
- [ ] If implemented, verify only the approved documentation/UI corrections and
      ensure no behavior, layout system, dependency or product module expansion
      was smuggled into the optional scope.

## 16. Plan 16 — branch lifecycle enforcement

- [ ] Owner-only branch deactivate/reactivate behavior is enforced server-side.
- [ ] Inactive branches reject new assignments, placements, stock receipts,
      checkout and other selected writes according to the approved matrix.
- [ ] Authorized history, reports, refunds/corrections and recovery behavior
      remain available exactly where approved.
- [ ] Existing sessions and in-flight operations fail safely after closure;
      retries do not partially write or bypass branch status.
- [ ] Branch membership, merchant participation, invitations and tenant scope
      remain consistent after deactivation/reactivation.
- [ ] No automatic data deletion or unauthorized occupancy/stock mutation occurs.

## 17. Plan 17 — directory pagination, access history and POS browsing

- [ ] Members and invitations return bounded 15-row pages, stable ordering,
      validated search/status filters, totals and consistent expiry predicates.
- [ ] Merchants and products preserve existing filters, role-specific projections,
      affiliation visibility and assigned-branch stock/privacy boundaries.
- [ ] Every picker/selector consumer uses bounded search or authorized selected-ID
      lookup; changing pages never drops valid selected IDs.
- [ ] Empty, out-of-range, late-response, retry, filter-reset and final-page
      clamp behavior is correct.
- [ ] Member access history records only committed Owner-authorized role,
      branch, merchant-link and removal changes.
- [ ] Access events are atomic with the mutation, do not duplicate on retry/no-op,
      survive target membership removal and obey tenant/retention policy.
- [ ] History is Owner-only, paginated, newest-first and safe after demotion or
      account anonymization.
- [ ] POS returns at most 15 rows per batch with a validated scope-bound cursor;
      Load more preserves current rows and does not mutate cart/checkout.
- [ ] Scanner/exact-code lookup works beyond the loaded page and preserves
      leading-zero, case and ambiguity behavior.
- [ ] Cursor/search/access changes reset safely; stale or revoked access cannot
      append hidden rows.

## 18. Plan 18 — durable checkout/refund outcome recovery

- [ ] Frozen command/request ID, input, authorization scope and retention rules
      are persisted before an uncertain outcome can be recovered.
- [ ] Reload, reopen, sign-out/sign-in, refresh, cross-tab and response-loss flows
      find the original outcome without resubmitting automatically.
- [ ] Completed outcome replays the exact saved response and never duplicates
      money, stock, refund, restock or movement records.
- [ ] Explicit retry is allowed only for unchanged content and fresh authorized
      context; changed price, stock, account, role, branch or tenant is rejected.
- [ ] Unknown/pending/failed/completed states have safe UI and operator actions.
- [ ] Concurrent recovery requests serialize or replay safely.
- [ ] Revoked access, inactive organization/branch, deleted/anonymized user and
      cross-tenant guessed command IDs cannot recover another tenant's outcome.
- [ ] Retention cleanup does not remove records needed for approved recovery or
      violate financial/history policy.
- [ ] Manual Plan 10 fallback is documented for unavailable recovery services.

## 19. Plan 19 — scoped Reports CSV exports

Plan 19 is optional and not a pilot blocker unless explicitly promoted.

- [ ] Explicitly defer it; or approve the exact export scope before implementation.
- [ ] If implemented, exports preserve current role/tenant/branch/date/search/sort
      filters and include the complete bounded result set.
- [ ] Export limits, timeout/memory behavior and user feedback are explicit.
- [ ] Decimal values, dates, Unicode, quoting, delimiters, line endings and
      empty values are exact and stable.
- [ ] Formula-injection values are safely escaped and private fields are absent.
- [ ] Export authorization is rechecked server-side and cannot be widened by
      query parameters or a stale UI filter.

## 20. Plan 20 — Spaces maintenance and occupancy actor privacy

- [ ] Owner can create, rename, archive and reactivate organization types using
      stable IDs and expected-version concurrency.
- [ ] Names are trimmed, bounded and case-insensitively unique across active and
      archived types; archive does not free a name.
- [ ] Rename cascades current labels without changing occupancy dates, merchants,
      actor IDs, financial data or history ownership.
- [ ] Archived types remain valid for existing spaces but cannot be selected for
      new spaces or type changes; unchanged archived selections remain editable.
- [ ] Unknown/stale type labels cannot recreate old catalog rows through the
      removed auto-registration trigger.
- [ ] Only Owners can mutate types/spaces; Managers read as authorized, Cashiers
      remain denied and Merchants remain own-scope.
- [ ] Merchant list, detail, current-occupancy, history and merchant-association
      responses contain no `releasedBy`, `releasedById` or nested release actor.
- [ ] Staff responses retain authorized nullable release actor identity.
- [ ] Merchant raw JSON remains private after role demotion, cache refresh,
      late responses, account anonymization and branch/tenant changes.
- [ ] Occupancy assignment/release rules, dates, overlap constraints, active
      merchant participation and branch scope remain unchanged.
- [ ] Concurrent rename/archive/reactivate/create/type-change operations do not
      duplicate, orphan or silently reassign spaces.

## 21. Cross-plan tenant, privacy and authorization QA

Run with at least two organizations, multiple branches and all existing roles.

- [ ] Replace every organization, branch, member, merchant, product, sale,
      refund, space, occupancy, account, command, invitation and history ID with
      a foreign-tenant ID; confirm safe not-found/denial behavior.
- [ ] Repeat tests after role change, branch removal, merchant relink, user
      deletion/anonymization, organization deactivation and session revocation.
- [ ] Confirm counts, search results, pagination totals, reports, selectors,
      error messages, logs and cached responses do not reveal hidden records.
- [ ] Confirm server-derived organization, role, actor, branch, merchant, account,
      prices, totals, stock and command values override or reject client guesses.
- [ ] Confirm all mutation authorization is repeated inside the transaction.
- [ ] Confirm composite foreign keys and constraints prevent cross-tenant joins.
- [ ] Confirm frontend hiding is backed by API denial, not treated as security.
- [ ] Confirm no raw private data appears in browser network responses, logs,
      error pages, PDFs, CSVs, OpenAPI or generated client artifacts.

## 22. Cross-plan financial, inventory and idempotency QA

- [ ] Sale totals, cash tender/change, payment references and decimal rounding
      remain exact at minimum, maximum, zero-change and decimal-edge values.
- [ ] Refund totals, payout account, item quantities, restock quantities and
      movement links remain exact for partial/full/zero-restock cases.
- [ ] Duplicate submit, refresh, timeout, retry, tab duplication and concurrent
      writes produce at most one financial/stock effect per command.
- [ ] Stale price, stock, branch, account, role and organization state fails
      without partial writes.
- [ ] Reports reconcile to recorded sales/refunds by authorized scope and date;
      no report silently treats provider balances as verified balances.
- [ ] Inventory movements, sale/refund items, snapshots and history cannot be
      edited/deleted through unauthorized paths.
- [ ] Restore/recovery preserves all financial and stock invariants.

## 23. Final manual workflow script

Record account, organization, branch, timestamp and evidence for each run. Use
synthetic/staging data unless a bounded pilot has already been approved.

- [ ] Owner: create organization/branch/type/account/product, invite users,
      assign access, receive stock, checkout, receipt, refund, report, space
      assignment, release and history.
- [ ] Manager: assigned-branch inventory/POS/reports/spaces reads; verify denied
      Owner-only writes and hidden unassigned-branch data.
- [ ] Cashier: assigned-branch checkout/refund/history only; verify denied
      organization management, spaces/type management and unauthorized branches.
- [ ] Merchant: own products/sales/reports/spaces only; verify no actor,
      payment, other-merchant, contact or hidden-branch leakage.
- [ ] Recovery: force timeout/response loss after commit, reload and recover;
      verify no duplicate result and safe escalation.
- [ ] Outage: stop API/database/email dependency in staging, observe readiness,
      logs, alerts, user message and operator runbook; restore and verify recovery.
- [ ] Responsive/accessibility: 320px, 390px, tablet, desktop, keyboard, zoom,
      reduced motion, screen reader, print/PDF and slow network.

## 24. Evidence index and final decision

For every passed item, record a short evidence link or artifact ID. For every
failed/deferred item, record impact, owner, mitigation, expiry/trigger and the
decision authority.

```text
Plan 01 evidence: ______________________________________________
Plan 02 evidence: ______________________________________________
Plan 03 evidence: ______________________________________________
Plan 04 evidence: ______________________________________________
Plan 05 evidence: ______________________________________________
Plan 06 evidence: ______________________________________________
Plan 07 evidence: ______________________________________________
Plan 08 evidence: ______________________________________________
Plan 09 evidence: ______________________________________________
Plan 10 evidence: ______________________________________________
Plan 11 evidence: ______________________________________________
Plan 12 evidence: ______________________________________________
Plan 13 evidence: ______________________________________________
Plan 14 packet:   ______________________________________________
Plan 15 decision: ______________________________________________
Plan 16 evidence: ______________________________________________
Plan 17 evidence: ______________________________________________
Plan 18 evidence: ______________________________________________
Plan 19 decision: ______________________________________________
Plan 20 evidence: ______________________________________________
Open blockers:    ______________________________________________
Accepted limits:  ______________________________________________
Final decision:   ______________________________________________
Approver/date:    ______________________________________________
```

Plan 14 may be marked `BOUNDED PILOT APPROVED` only when every pilot-critical
gate is passed or explicitly accepted by the authorized approver, with no
unresolved tenant-isolation, financial-integrity, recovery, critical-security
or privacy blocker. Paid launch is a separate later decision. If evidence is
missing, the safe result is `NO-GO` or `STAGING ONLY`.
