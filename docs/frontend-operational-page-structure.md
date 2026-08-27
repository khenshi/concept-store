# Operational Page Structure

## Part 2 scope

This part creates reusable authenticated-page structure and applies it to the Products and Inventory operational views. It changes presentation only and preserves existing loading, filtering, mutation, caching, authorization, and API behavior.

## Shared primitives

`frontend/src/components/ui/operational-page.tsx` provides:

- `OperationalPage` for the wide, centered authenticated content canvas
- `OperationalPanel` for a bordered white surface with a consistent title, description, and action area
- `OperationalToolbar` for search and filter controls separated from result content
- `FilterField` for consistently labeled operational filters
- `StatusNotice` for explicit success and warning feedback

These components contain layout and visual conventions only. They do not own business state or data fetching.

## Applied views

### Products

- The catalog count and purpose are shown in the panel header.
- The Add Product action remains prominent and authorization-aware.
- Search, merchant, and status filters are grouped in a dedicated toolbar.
- Results use the full panel width with consistent row gutters.

### Inventory

- Current stock count and branch-specific meaning are presented in the panel header.
- Stock-in remains the primary contextual action.
- Search, branch, merchant, and status filters use the shared toolbar and fields.
- Results and pagination align to the same content gutters.
- Movement history remains lazy-loaded and behavior is unchanged.

## Design alignment

- Page headings use compact operational hierarchy rather than marketing-page scale.
- White surfaces, slate borders, and the Cloud Slate canvas provide structure without decorative elevation.
- Emerald remains reserved for actions, active state, and meaningful feedback.
- Responsive controls collapse in task order for tablet layouts.

## Exclusions

- No backend changes
- No API or business-rule changes
- No new product or inventory capabilities
- No POS, sales, finance, reporting, or other future milestone functionality

## Validation

- Prettier formatting
- TypeScript checking
- ESLint
- Frontend tests
- Next.js production build
