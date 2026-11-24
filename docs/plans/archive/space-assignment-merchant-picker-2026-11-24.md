# Space assignment merchant picker

**Status:** Implemented November 24, 2026.

## Approved scope

The Assign space modal's merchant selection should be one closed dropdown. On
activation it should become a search field and present the active merchant list.
The change is frontend-only and preserves the existing paged association reads,
assignment validation, and branch selection behavior.

## Implementation

- Added an opt-in search-on-open mode to the shared paged option picker.
- Applied that mode to merchant selection in the Assign space modal.
- Kept the chosen merchant label visible after the picker closes.
- Preserved loading, empty, retry, pagination, outside-click, Escape, and
  selection behavior.
- Added regression coverage for opening the picker, searching-mode semantics,
  merchant selection, and assignment conflict handling.
- Updated Spaces module documentation.

## Validation

- Focused merchant assignment tests: passed, 2 tests.
- Frontend typecheck: passed.
- Frontend lint: passed with six pre-existing warnings and no errors.
- Full Spaces spec: 17 passed, 1 pre-existing unrelated failure in the inline
  space-type description assertion.
