# Workflow Refinement — Part 1

## Scope

This part refines Product status actions and removes duplicate modal dismissal controls from Product and Inventory workflows.

## Product status confirmation

- Activating and deactivating a Product now requires the shared confirmation dialog.
- Activation uses the primary emerald confirmation treatment.
- Deactivation uses the destructive treatment and explains that historical records remain available.
- The existing Product status endpoint, authorization, pending state, cache update, and success feedback are unchanged.

## Product actions

- The View Stock row action was removed as requested.
- Edit and activate/deactivate actions remain available.
- Product inventory remains accessible from the primary Inventory workspace and its filters.

## Modal dismissal

- The duplicate header Close button was removed from the Add/Edit Product modal.
- The duplicate header Close button was removed from the shared Stock-in/Inventory Adjustment modal.
- Both modals retain their footer Cancel action and backdrop dismissal when no save is pending.

## Validation

- Prettier formatting
- TypeScript checking
- ESLint
- Frontend tests
- Next.js production build
