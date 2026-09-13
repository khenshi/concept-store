# Current Implementation Plan

**Status:** Completed and reviewed. Part 1 committed as `f98587c`; Part 2 committed as `597a5fa`. The user explicitly waived rendered QA for this refinement on September 13, 2026.

# POS Navigation and Workspace Refinement

## Requested scope

Frontend-only refinement of the implemented POS and staff sales-history screens:

- Add POS to organization sidebar/mobile navigation for OWNER, MANAGER and CASHIER.
  MERCHANT retains its separate read-only Sales entry, without POS access.
- Add an organization-level POS entry that offers an accessible branch selection.
  Do not silently select a branch for a checkout. Provide loading, empty/unassigned,
  failed-read and retry states using existing authorized branch reads.
- Replace the POS branch title with a labeled branch dropdown. Owners see tenant
  branches; managers/cashiers see only assigned branches. A voluntary branch change
  warns before discarding a nonempty cart and clears its payment draft. Pending or
  uncertain checkout blocks unsafe switching and retains same-command recovery.
- Present Cart and Sales History as route-backed navigation tabs within one POS
  workspace/header. Staff receipt detail stays in this workspace with History active.
  Preserve existing sales filtering, pagination, cashier own-sale scope and printing.
- Remove the normal POS back button and standalone sales-history shortcut in favor
  of sidebar navigation and tabs. Keep necessary access/recovery actions.

## Confirmed cart behavior

Switching Cart/History tabs within the same branch preserves the in-memory cart
and payment draft; it does not complete checkout or reserve stock. Returning to Cart
requires current authorized reads and checkout remains authoritative. Pending or
unknown checkout must be resolved before switching tabs. Changing branch,
organization, role or user still clears editable cart state; frozen unresolved
commands retain the existing safe in-memory recovery behavior.

## Dependencies and exclusions

Reuse organization shell/context, existing branch/POS/sales APIs, feature-owned
schemas, native dialogs and DESIGN.md. Preserve merchant own-sales routes and old
staff deep links through compatible routing. No backend, schema, authorization,
payment, inventory or receipt-business-rule changes; no persistent/offline carts,
new infrastructure, reports or unrelated refactors.

Preserve unrelated user edits, including inventory-api.ts, root package files and
the performance audit. Do not commit them.

## Part-by-part delivery

1. Sidebar POS entry, authorized branch-title dropdown and normal back-button removal.
2. Shared route-backed Cart/History/receipt workspace and confirmed cart retention.

Part 1 includes explicit organization-level selection, assigned-only branch options,
empty/error/retry feedback, cancellation/confirmed cart clearing, checkout locks,
revoked-access clearing and obsolete-response guards. The existing history shortcut
remains until Part 2 supplies its replacement tabs. No backend/schema changes.
Frontend production build, lint, type checking, changed-file formatting and all
413 tests across 65 files pass. `git diff --check` passes. Full frontend formatting
flags only the pre-existing unrelated inventory-api.ts edit, preserved unchanged.
Rendered QA was pending at Part 1 delivery and subsequently explicitly waived.

Part 2 implements a persistent branch POS layout with route-backed Cart/History
links and embedded staff receipt detail. Same-scope cart/payment draft and history
dates/pagination survive these page changes. Inactive reads pause and clear old
results; returning Cart waits for fresh branch/catalog reads before payment review.
Pending/unknown checkout blocks switching and remains visible even after a browser
history/deep-link transition. Only the active receipt mounts a print portal.
Old staff history/receipt links redirect into POS; merchant routes stay separate.
All 430 frontend tests across 67 files, lint, type checking, production build,
changed-file formatting and diff checks pass. The unrelated inventory API/root
package/performance audit changes are preserved. Rendered QA was explicitly waived
for this refinement; it was not performed.

Stop for review after each part; commit only after approval. Update affected module
docs after implementation and archive this plan after final approval.

## Verification

Frontend format, lint, type checking, unit/component tests, production build and
diff checks. Cover role-aware sidebar/active routes, assigned-only branch options,
empty/denied access, cancellation and confirmed branch clearing, stale responses,
tab draft retention, checkout locks/recovery, staff receipt/history reads and
unchanged merchant restrictions. The user explicitly waived rendered
dropdown/tab/responsive/keyboard/dialog/zoom/print QA for this refinement on
September 13, 2026. This is a separate waiver from prior milestones. Automated
checks do not certify browser-rendered behavior or actual printing.

The previous completed POS/sales record is historical only:
[Branch POS Checkout and Sales](branch-pos-checkout-and-sales-2026-09-13.md).
The user approved this refinement and same-branch tab draft retention.
