# Owner and Manager Workflow Refactor

## Scope

This refactor reorganizes the existing Milestones 1–4 owner/manager frontend around operational workflows. It does not add backend behavior or future milestone features.

## Information architecture

The persistent organization navigation is grouped into:

- **Operations:** Products and Inventory
- **Business:** Merchants, Branches, and Members

Spaces are no longer presented as an independent top-level area. The existing route remains available and is opened from a selected branch or merchant context. POS, finance, reporting, offline behavior, and billing remain outside the current scope.

## Contextual workflows

- A branch workspace drawer links directly to that branch's spaces, inventory, and organization members.
- Merchant profiles link to merchant-filtered products and inventory, plus the space workflow for a participating branch.
- Product rows link directly to product-filtered physical inventory.
- Branch, merchant, and product context is carried in URL query parameters, making views linkable and preserving the selected scope on entry.
- Members continue to represent organization roles only. The interface does not claim branch-level access because the current domain/API does not implement it.

## Data loading

The persistent organization workspace provider now deduplicates and caches branch, merchant, and product reference requests. Products, inventory, and the merchant directory reuse this data during organization navigation. Filtered result sets remain page-specific so each screen loads only the records requested by its filters.

Inventory movement history remains loaded on demand and cached after its first opening. Mutations update local/shared product data without forcing unrelated page reloads.

## Compatibility and business rules

- Existing routes, API contracts, authorization checks, CRUD actions, agreement history, assignment rules, and inventory movement behavior are preserved.
- Owners and managers retain their existing access. No new role or tenant behavior is introduced.
- The standalone spaces URL remains as a compatible contextual route, even though it is not a primary navigation item.

## Validation

- Frontend formatting
- Frontend type checking
- Frontend linting
- Frontend unit tests
- Frontend production build
