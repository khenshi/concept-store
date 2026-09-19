# Current Implementation Plan

**Status:** Approved September 19, 2026. Deliver this focused frontend change
uncommitted for review; commit only after approval.

## Organization chooser layout refinement

Recompose `/app` to match the supplied organization-picker reference while
following `DESIGN.md`: one unified Paper background, an editorial title/action
header, a compact search/count row, and a responsive grid of lightly contained
organization cards. Rounded corners are intentional on the cards and controls;
they provide modern affordance without turning every application section into a
card stack.

Preserve the existing organization list request, search filtering, role labels,
loading/error/empty states, create-organization dialog, keyboard focus behavior,
authorization and navigation. Do not invent member counts, activity dates,
sorting behavior, menus, dashboard data or backend changes. The operational
chooser treatment is monochrome for now; semantic success, warning and danger
feedback may retain their meaning-bearing colors. The public landing
page and all other application routes are out of scope for this focused change.

### Review status

Implementation is pending review. Rendered browser QA is not available unless a
browser is connected; automated tests will cover the preserved list and dialog
workflows and the new card structure.
