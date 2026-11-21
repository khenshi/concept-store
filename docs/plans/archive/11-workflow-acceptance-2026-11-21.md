# Plan 11: End-to-end workflow, accessibility and receipt acceptance

Date: October 24, 2026

Status: Approved for implementation October 26, 2026. Application edits are
limited to the narrow route-recovery and confirmation slice in this plan;
browser acceptance, printing, database operations and deployments remain
separate evidence activities.

Priority: P0 for authorization, financial safety and blocked essential tasks before
real pilot use. Qualify other usability defects by impact, not cosmetic preference.

## 1. Goal, decisions and boundaries

Prove a real store can complete its authorized workflows and safely recover from
errors. Own the role/workflow, receipt, accessibility and route-recovery gates in
the [deployment checklist](../../deployment-readiness-checklist.md), §6 identity
smoke and §7. Preserve DESIGN.md's operational visual system, existing layouts,
shared table/dialog controls and authored typography choices. No redesign.

Confirmed October 24: intended browsers/devices/printer are undecided. The pilot
may start with saved receipts and browser PDF; physical-printer testing is deferred
until hardware/paper/browser are selected. This does not certify any printer.
Saved receipt access, PDF output and safe reprinting still require actual tests.

Includes narrowly scoped route error/not-found recovery, agreed merchant/product
status explanation improvements and the outlined account-deletion confirmation
action. Excludes lifecycle/business-rule changes, receipt tax certification,
offline checkout, new reports, automated billing, settlements and generic component
rewrites. Other feature plans own their new behavior and service contracts.

Use lean-build's narrow implementation scope and impeccable's Operate-mode
acceptance: task clarity, semantic controls, stable loading, accessible feedback
and incumbent design take priority over new visual expression. No new packages
without capability review and user approval.

## 2. Current evidence and weaknesses

Reviewed PRODUCT.md/DESIGN.md, frontend-experience documentation, app route inventory,
SaleReceipt, shared FormDialog/ModalActionRow/RequestError, package scripts and
the recorded module-review requirements.

- No app `error.tsx`/custom `not-found.tsx` appeared in the route inventory.
  RequestError covers explicit request failures, not arbitrary render exceptions.
- FormDialog uses native dialog, heading/initial focus, focus restoration and
  pending dismissal protection. Reuse it; DOM mocks do not prove native behavior.
- SaleReceipt renders saved data with a separate body-level print portal and
  print CSS. `window.print()` requests a dialog; feedback correctly does not
  assert successful printing. Current fixed method rendering must migrate under 08.
- Print CSS uses page margins/padding without evidence of thermal-paper support.
  Locale-based receipt timestamps also need checking against business expectations;
  no silent global date/time rewrite is authorized.
- Frontend scripts include Vitest and static/build checks, not a browser E2E
  runner. Old rendered-QA waivers and historical test counts are not launch proof.
- Recent POS, reports, modal, table and calendar changes require current browser
  checks. No fresh application tests/browser/print checks ran for this draft.

## 3. Prerequisites and evidence method

01 repairs baseline; 02–07 provide runtime/auth/hosting/release/onboarding safety;
08 Payment Accounts and 09 All Branches are required before pilot qualification.
10 supplies incident/runbook behavior; 16 branch lifecycle, 17 directory changes,
18 durable financial recovery and 20 Merchant actor-privacy correction are tested
when included/required by the queue. 12 owns load/security depth; 13 policies;
14 final release sign-off. Do not treat unimplemented dependencies as passing tests.

Use synthetic fixtures in an independently verified disposable/staging target:
two organizations, multiple branches, all four roles, assigned/unassigned staff,
linked/unlinked/relinked merchants and active/inactive entities. Include shared
accounts, historical disabled accounts, long names/codes and enough rows for
multiple 15-row pages. Never test destructive flows against real store data.

For every scenario record role, environment, release SHA, prerequisites, actions,
expected state, observed result, backend/data proof where needed, evidence link
and unresolved defect. Separate unit, mocked HTTP, real PostgreSQL, browser and
PDF/device evidence. Screenshots cannot establish transactional integrity, and a
200 response cannot establish correct rendering or privacy.

## 4. End-to-end acceptance matrix

| Workflow               | Required proof                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enrollment/accounts    | Operator provisions/activates; verify email, login/reset, session revocation, explicit invitation accept, mail/Copy link and permanent removal. No public tenant creation or Owner self-activation.                                         |
| Scope/access           | Tenant switch, assigned Manager/Cashier branches, Merchant own-only history, role/grant revocation, relink/unlink and inactive-tenant history. Guessed IDs/direct routes/API responses do not leak foreign data.                            |
| Catalog/inventory      | Merchant/product setup, branch placement, receive/adjust, confirm correction, edit price/threshold, invalid/unchanged saves, movement filters and history. Preserve exact stock and saved prices.                                           |
| Checkout               | Scan exact code, product search/Load more, cart edits, fullscreen branch context, Cash tender/change, required/optional references and disabled/unassigned account rejection. Reviewed price/stock conflicts require deliberate correction. |
| Outcomes/receipts      | Lost response after commit, reload/reopen, multiple tabs, same-command retry, access loss, saved receipt/PDF, history View and correct returnTo. No duplicate charge/stock deduction or mutation from printing/navigation.                  |
| Returns/refunds        | Select sale, partial/multiple returns, restock bounds, payout account different from sale, unknown-outcome recovery and repeated clicks. At most one saved refund/restock per command; no instruction to pay twice.                         |
| Reports                | All four tabs, bounded/custom/All Time periods, one/all authorized branches, globally paginated rows, actual-account Received/Refunded/Net and negative periods. Exact totals and own-only Merchant projections.                            |
| Spaces                 | Type/space creation, assign/release/archive, occupancy search/date/pagination, current occupier, historical references and Merchant-safe actor projection. Preserve underlying lifecycle rules.                                             |
| Membership/directories | Owner role/branch editing, last-Owner protection, invitation states, 15-row search/filter/pagination and approved scoped access history; other roles denied management APIs.                                                                |

Run each essential flow with slow requests, empty/no-match/error states, expired
sessions and navigation/back/forward. Disable repeated submits while pending;
validation errors should not appear merely because untouched inputs rendered.
Never automatically retry a financial write as a generic error recovery action.

## 5. Narrow implementation: safe route recovery

Inventory layout ownership before editing. Choose boundaries at the smallest
useful organization/feature segments, plus root fallback only where necessary.
Account for errors in layouts not caught by a child boundary. Keep thin routes,
feature-owned behavior and dependency direction; shared UI must not import features.
No blanket wrapping of every component or global router framework.

Boundary/not-found content has an accessible heading, safe concise explanation,
read retry where valid and authorized navigation destination. Do not display stack
traces, tokens, foreign tenant names or private exception data. Distinguish expected
not-found/access denial from infrastructure failure without an existence oracle.
Support errors during initial render, navigation and data parsing; local validation
remains inline, not swallowed by a boundary. Test fallback errors themselves.

An error-boundary reset is a render/read retry, not a command retry. Before choosing
scope, verify 18's durable attempt lifecycle survives unmount/remount and root
fallback. Never clear frozen checkout/refund state, abandon uncertainty, switch
tenant to evade a lock or auto-submit during reload/recovery. Reauthenticate and
revalidate user/tenant/branch access before showing data. If outcome cannot be
resolved, offer 10's support guidance; absent records do not prove rollback.

No error boundary promises it catches every event-handler/async failure: retain
explicit request/mutation handling and inspect unhandled rejection paths. Test
malformed deep links, stale detail IDs, lost grants and back-navigation targets.

## 6. Narrow implementation: confirmation guidance

- Merchant status confirmations explain restrictions on new sales, products/
  placements and stock receipts, affected space releases, and preserved saved
  history/balances. Reactivation does not restore space assignments. Derive wording
  from actual implemented service rules; do not add enforcement here.
- Product status confirmations explain restrictions on selling, new placements and
  stock receipts while prices, balances and history remain. No destructive rewrite.
- Account deletion initial action follows the already-approved outlined design;
  preserve current-password validation, sole-Owner protection, pending locks,
  dismissal/focus restoration and server checks. No new deletion policy.

Keep confirmations concise, specific and readable with long entity names. Use
existing confirmation/form primitives and danger semantics; do not invent
unimplemented downstream effects or add discard browser prompts previously removed.

## 7. Accessibility and responsive verification

Target the existing PRODUCT.md/DESIGN.md WCAG 2.2 AA requirement; this plan is not a
certification claim. Use keyboard plus manual assistive-technology checks alongside
automated/DOM checks. Select an available screen-reader/browser pair and record it.

- Logical headings/landmarks, persistent labels, associated hints/errors, meaningful
  button names and status announcements. Placeholder is not a label.
- Tab/Shift+Tab, Enter/Space, custom picker arrow keys/Home/End/Escape, no keyboard
  traps, visible focus and predictable dialog focus entry/return. Pending actions
  prevent unsafe dismissal without stranding the user.
- Custom calendars: one/two dates, clear/apply, keyboard state, supported range and
  popover placement within dialogs and viewport. No right/bottom clipping at zoom.
- Contrast/focus/status/error distinctions across available themes; no color-only
  amount/status/account indicators. Reduced motion disables nonessential notice
  animation without hiding outcomes. No broad theme redesign.
- 320px viewport, representative tablet/desktop and 200% zoom: readable controls,
  sticky headers/footers that do not cover fields/actions, accessible touch targets,
  table horizontal scrolling within its container and preserved column meaning.
- Search remains editable during loading; headers/selectors do not jump between
  incompatible skeletons. Tables retain pagination separators, current/total pages,
  default 15, empty-state bottom padding and consistent filter labels.

Proposed browser coverage pending actual store setup: desktop Chrome/Edge and
mobile Safari/Chrome, with representative OS/device/version recorded at testing.
This is a proposal, not an approved exclusive support policy or current-version
guarantee. Browser QA runs in bounded desktop/mobile passes; fix scoped defects,
then confirm rather than endlessly polishing. Material redesign requires approval.

## 8. Receipt and PDF acceptance

Save one completed sale and repeatedly view/print that same saved record. Verify
identity, branch, cashier, date/time, item snapshots, quantities/prices/totals,
account snapshot, applicable tender/change/reference and internal-not-fiscal notice.
Merchant-reduced views must not gain printing or whole-payment fields.

Use browser Save as PDF with short and multipage receipts, long names/references,
many items and representative amounts. Inspect rendered pages: no clipped columns,
blank portal pages, modal/backdrop/action leakage, dark-theme illegibility or missing
totals/disclaimer. Print cancellation/failure leaves sale completed and reprintable;
no success message asserts physical output. Verify permitted access after reload.

Physical printer/paper/browser qualification remains explicitly blocked/deferred
per user decision, not a pilot blocker when the tested saved/PDF path is accepted.
Before advertising hardware support, select actual hardware and test margins,
paper width, scaling/page breaks and reconnect/reprint. Do not presume 58/80mm
thermal support from generic page CSS. PDF is an internal record, not automatic
tax-invoice compliance; 13 owns qualified business-policy review.

## 9. Phases, failure handling and completion

1. Finalize scenario/evidence matrix and fixture invariants; verify prerequisites.
   Choose supported pilot browsers and identify unqualified hardware explicitly.
2. Implement only approved route recovery/confirmation changes with colocated
   regression tests and preserved API/authorization contracts. If an independent
   business-rule defect is found, send it to its owning plan instead of expanding.
3. Run formatting/lint, application/test-source typechecks, relevant Vitest/unit/
   HTTP suites, verified disposable-DB integration and builds through 06. No new
   browser tooling without approval; existing tools plus recorded manual checks
   are acceptable if evidence is complete. Do not weaken baseline tests.
4. Exercise browser roles/workflows/accessibility, PDF and 10/18 failure scenarios
   against the exact release candidate. Log reproducible defects and fix critical
   safety/task-blocking issues, then rerun affected paths. Security/financial fixes
   need deep implementation review through the responsible plan.
5. Publish evidence and residual risks for 14. Historic waivers do not satisfy this
   gate; any new deferral records the untested surface and separate user acceptance.
   An undecided browser setup remains a qualification gate, not inferred success.

Update frontend-experience and affected account/merchant/product/POS/refund module
docs only after actual behavior ships, plus dated acceptance evidence under a
dedicated documentation path. Do not rewrite current behavior docs with proposals.
Rollback scoped UI changes to compatible known behavior without losing 18's saved
commands or broadening access; never reset DB/history to fix a browser issue.

Complete when essential authorized workflows pass, excluded roles remain denied,
unknown outcomes survive recovery without duplicate effects, required accessibility
and saved/PDF evidence is recorded, narrow UI changes are verified and documentation
reflects reality. Unqualified printer support and chosen-browser limitations remain
visible in the pilot handoff. The approved route-recovery and confirmation slice
is implemented separately from the remaining browser, receipt/PDF and device
acceptance evidence; this plan is not complete until those gates are recorded.
