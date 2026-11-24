# Branch-preserving POS navigation

**Status:** Completed November 24, 2026.

## Approved scope

Preserve the active branch when organization navigation moves from a
branch-scoped Spaces, Inventory, Reports, or Sales route to POS. Add focused
navigation regression coverage and update the POS module documentation.

No database, API, authorization, authentication, cart, or branch-selection
behavior changes were included.

## Implementation

The organization navigation now derives the active branch from a
branch-scoped route and links directly to that branch's POS checkout route.
Organization-level POS links remain unchanged.

## Verification

- Organization navigation and shared branch-selection suites: 49 tests passed.
- `git diff --check`: passed.
