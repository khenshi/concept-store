# Branch and Merchant Workspace Refactor

## Part 3 scope

This part applies the authenticated operational layout to Branch and Merchant workflows. Existing authorization, forms, API requests, branch participation, lifecycle status, space assignments, and agreement behavior remain unchanged.

## Branch workflow

- Branches are presented as store locations in a wide operational panel.
- Adding a branch is now an explicit primary action; the detailed form stays out of the routine list view until requested.
- Editing continues to use the existing validated form and returns to the location list after saving or cancelling.
- Each branch opens a contextual workspace drawer for branch details, spaces and assignments, inventory, and organization members.
- Member copy explicitly avoids implying branch-level access because that capability is not implemented by the current backend.

## Merchant workflow

- The Merchant directory uses the shared panel and filter-toolbar structure.
- Search and lifecycle status filters remain server-backed and unchanged.
- Merchant profiles use the shared wide workspace canvas.
- Existing profile editing, branch participation, lifecycle status, agreement history, and agreement actions are preserved.
- Contextual links continue to connect a merchant to products, physical inventory, and spaces in a participating branch.

## Design alignment

- Primary actions use Operational Emerald.
- White operational surfaces use Hairline Slate boundaries with no resting elevation.
- Counts and supporting context are placed in panel descriptions rather than decorative dashboard cards.
- Forms and contextual details remain separate from routine directory scanning.

## Explicit exclusions

- No backend or schema changes
- No branch-specific member access
- No new merchant or agreement behavior
- No POS, settlements, payouts, reporting, or billing

## Validation

- Prettier formatting
- TypeScript checking
- ESLint
- Frontend tests
- Next.js production build
