# Milestone 3: Authenticated Frontend Refactor

## Goal

Refactor the authenticated application incrementally so daily operational pages follow `DESIGN.md`, share persistent data appropriately, and remain visually connected to the landing page without changing business behavior.

`PRODUCT.md` supplies the user and workflow context. This work preserves the owner, manager, cashier, and merchant authorization boundaries already enforced by the backend and existing routes.

## Part 1 scope

This first part establishes the persistent organization workspace foundation and migrates the organization overview and space-management page.

It does not add new product features, change API contracts, modify business rules, or refactor the branch, merchant, and member feature internals yet.

## Design corrections

- Authenticated content and header alignment now use the design system's 64rem maximum workspace width.
- Static cards and panels use white surfaces with one-pixel slate borders and no resting shadows.
- The header uses a solid white surface rather than transparency or glass-like treatment.
- Organization pages share one headline, role badge, description, and navigation hierarchy.
- The overview uses operational destination rows instead of marketing-style calls to action.
- Loading states use lightweight structural skeletons while preserving clear screen-reader status text.

All presentation remains in Tailwind utilities or shared React components. `globals.css` remains limited to document-level base behavior.

## Persistent organization data

The dynamic organization route now owns an `OrganizationWorkspaceProvider`. Next.js preserves this nested layout while navigating between pages under the same organization.

The provider:

- fetches the organization once for the active organization route
- exposes one shared organization loading and error state
- loads branches lazily only when a migrated page requests them
- caches successful branch results across sibling route navigation
- deduplicates simultaneous branch requests through one in-flight promise
- supports explicit refresh after an error or future mutation

This is deliberately a small React context rather than a new state-management or data-fetching dependency. Feature-specific data such as spaces remains owned by the page that needs it.

## Migrated pages

### Organization overview

The overview consumes the persistent organization record and presents role-appropriate operational destinations with the shared organization page header.

### Space management

Space management reuses the persistent organization record and lazy branch cache. Only branch-specific spaces are fetched when the selected branch changes. Branch loading failures do not replace the already-rendered organization page header.

## Remaining refactor parts

Subsequent reviewable parts will migrate:

1. branches and organization members
2. merchant directory and merchant profile
3. organization selector and shared form/list patterns
4. final authenticated responsive, accessibility, and performance validation

Milestone 3 assignment and agreement features remain paused until this refactor is reviewed.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
git diff --check
```
