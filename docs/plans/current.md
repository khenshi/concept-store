# Current Implementation Plan

**Status:** Approved. Part 1 reviewed and approved for commit.
Part 2 final verification/rendered QA is next.

The Item Returns and Manual Refunds MVP is complete. All six delivery parts were
reviewed and approved, final automated checks passed, and rendered refund QA was
explicitly waived September 14, 2026. The historical plan is archived in
[Item Returns and Manual Refunds MVP](archive/item-returns-and-manual-refunds-mvp-2026-09-14.md).

## Shared branch selection across workspace pages

### Confirmed direction

Keep the selected branch when navigating among POS, Inventory and Reports in the
same organization. Switching organizations clears the selection, including when
returning to the previous organization. The user confirmed this behavior.

### Smallest complete scope

- Keep one selected branch ID in the organization workspace's frontend context,
  not separate per-feature preferences. Use in-memory state for page-to-page
  navigation; full reload/browser restart persistence is excluded.
- Organization-level POS, Inventory and Reports entries reuse that branch after
  their existing feature-specific authorized branch lookup succeeds. Navigate to
  its existing branch route, without silently choosing a different branch.
- With no selection, keep the existing explicit branch picker, even with one
  accessible branch. Dropdowns remain available for changing branches.
- Explicit branch URLs take precedence over remembered state. Record a branch
  only after the page's authorized branch lookup validates that route/selection.
  A denied, malformed or stale response must not establish a remembered branch.
- Changing a branch in any of these pages updates the common selection only once
  existing navigation/unsaved-change guards permit the transition. Cancelled or
  blocked navigation must preserve the previous selection and all existing drafts.
- Validate the remembered ID separately for each feature before loading its data.
  Merchant historical Reports access must never grant Inventory or POS access;
  cashier and manager role/grant restrictions remain unchanged. If that branch is
  unavailable for the destination, show its picker with access feedback and no
  automatic alternative. Do not erase another feature's valid preference solely
  because feature-specific access differs.
- Clear selection on organization changes, sign-out/user changes and role changes.
  Refresh access revalidates current grants; obsolete reads cannot restore old
  selections or tenant data. Backend object checks remain authoritative.
- Preserve pending/unknown checkout/refund locks, inventory write/unsaved-edit
  guards, merchant reduced contracts, original receipts and existing report date
  reset rules. Remember only branch identity, not carts, dates, searches or forms.

### Dependencies and exclusions

Use existing organization workspace context, branch identity lookups, thin routes,
POS navigation bridge and existing role/scope protections. No new sidebar items,
backend endpoints, schema/migration, database, infrastructure, storage preferences,
cross-branch summaries, merchant Sales navigation changes or product opening-stock
form defaults. Preserve unrelated Inventory API, root package and performance-audit
changes. Implemented module documentation remains unchanged until delivery.

### Delivery by parts

1. Implement shared scoped branch state and integrate POS, Inventory and Reports
   entries/branch dropdowns, with focused authorization, route precedence, cancelled
   navigation and organization/user/role reset tests. Update affected module docs.
   Stop uncommitted for review; commit only after approval.
2. Run final frontend formatting, lint, type checking, full tests and build; verify
   accessible branch reuse and checkout/refund/inventory navigation regressions.
   Rendered navigation/dropdown/focus QA requires browser access or a new explicit
   waiver for this change. Record results, stop for final review, then commit and
   archive after approval. Backend/database tests are unnecessary if unchanged.

### Acceptance checks

Part 1 delivery: the organization workspace exposes one memory-only shared branch
choice; POS/Inventory/Reports entries validate it with their feature-specific
lookups before reuse. Explicit authorized routes take precedence and permitted
dropdown changes update the common choice without duplicate redirects. No choice
or destination-inaccessible choice keeps the explicit picker without fallback.
Tenant/user/sign-out/role changes reset selection, same-role access refresh forces
revalidation, and older-generation callbacks/late reads cannot overwrite it.
Pending/unknown checkout/refund and cancelled inventory/cart/navigation guards
preserve the preference. Merchant Reports historical access never widens Inventory
or POS. Affected module docs describe implemented behavior. Frontend changed-file
formatting, lint, type checking, production build and 702 tests across 83 files
pass, including 22 new integration tests. No backend/schema/database/storage or
infrastructure changes are added; unrelated edits are preserved. The existing
multiple-lockfile build warning remains. New rendered navigation/dropdown/focus
QA and final delivery remain Part 2; Part 1 was reviewed and approved for commit.

Select branch A in POS, then open Inventory and Reports: each opens A only if its
own current lookup grants access. Select B in Inventory: POS/Reports reuse B.
Without a saved choice, or with a destination-inaccessible choice, the picker stays
explicit and no alternate branch is selected. Direct authorized branch links win.
Organization switching resets selection; previous organization preferences do not
return. Changed user/role, revoked access, late responses and cancelled/locked
navigation cannot leak or overwrite selection. Merchant/cashier restrictions and
all existing workflow guards remain intact.
