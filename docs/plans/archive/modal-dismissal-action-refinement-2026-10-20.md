# Modal dismissal action refinement

**Status:** Implemented October 20, 2026.

## Delivered

- Updated modal Cancel and equivalent dismissal actions to use the shared
  borderless quiet button treatment.
- Kept primary, danger, retry, navigation, and other non-dismiss secondary
  actions unchanged.
- Preserved existing modal behavior, disabled states and validation feedback.

## Verification

- Type checking, focused tests, linting and diff checks were run after the
  implementation.
- Browser QA was not available in this session.
