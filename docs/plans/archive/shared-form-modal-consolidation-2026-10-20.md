# Shared form modal consolidation

**Status:** Implemented locally October 20, 2026; automated verification complete.
Rendered browser QA was not performed.

## Approved scope

Consolidate Add Merchant, Invite Member, Create Organization and the account
deletion password form onto `FormDialog`. Standardize typography, padding,
focus/dismissal handling and scroll containment while preserving workflow widths,
fields, validation, pending protections, success states and business/API behavior.
Keep confirmation prompts, navigation drawers, POS cart sheet and calendars as
distinct shared patterns. No backend, dependency or business changes.

## Implementation

- All four forms reuse the native shared shell. Size variants retain existing
  xl, 4xl, 5xl and md widths without changing existing dialog consumers.
- Shared optional alert-dialog semantics, backdrop-dismissal control and explicit
  return-focus fallback preserve the account and organization workflows.
- Initial field focus, title/success focus, pending Escape/backdrop guards,
  scrolling and opener restoration stay under the shared shell's ownership.
- Organization name drafts survive close/reopen; invitation fields and generated
  link success states remain feature-owned. Account deletion retains password
  focus and disallows backdrop dismissal.
- Updated frontend, organization, invitation, merchant and account module docs.
- Concurrent manual Inventory button-order changes were preserved untouched.

## Verification

- Existing focused baseline: 36 tests passed. Final focused suites: 45 passed.
- Frontend typecheck and production build passed.
- Lint: zero errors; five warnings in unrelated Inventory/Reports files.
- Formatting and final diff checks passed.
- Broader frontend run: 545 of 549 tests passed. Four failures involve POS
  copy/history controls and a Spaces layout assertion, outside the migrated
  modals; no unrelated test or implementation changes were made for them.
- No rendered desktop/mobile browser QA was performed. Native focus trapping
  and backdrop rendering are not established by DOM tests or the build.

No commits or deployment were requested for this task.
