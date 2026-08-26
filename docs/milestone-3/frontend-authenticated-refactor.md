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

### Branches and organization members

Branch management and organization member management now consume the persistent organization workspace instead of requesting the same organization independently on every sibling route.

- Branches use the shared page header and lazy branch cache.
- Creating or editing a branch updates the shared cache immediately, including branch selectors used by other organization pages.
- Branch request failures are isolated to the branch list, so the organization context and management form remain available.
- Organization members request only member data after the shared organization record establishes that the current role may view it.
- Member loading, empty, action-error, and request-error states remain local to the member workspace.
- Existing role boundaries, mutations, routes, and API contracts are unchanged.

### Merchant directory and profile

Merchant pages now reuse the persistent organization record and the shared lazy branch cache.

- The directory requests only merchant data and applies search/status filters without reloading the organization.
- Merchant profile and creation pages reuse cached branches instead of issuing a separate branch request on every route visit.
- Directory and profile failures are isolated from the persistent organization header and navigation.
- Structural skeletons preserve the page hierarchy while merchant-specific data loads.
- Profile creation, profile editing, lifecycle status changes, and branch assignment behavior remain unchanged.

### Organization selector and shared request states

The organization selector now follows the authenticated workspace spacing and uses navigational links for organization choices, allowing Next.js to handle route prefetching and standard link behavior.

Two narrowly scoped request-state components standardize repeated authenticated UI without abstracting feature logic:

- `ListSkeleton` provides consistent, accessible structural loading rows.
- `RequestError` provides a consistent error announcement and retry action.

The selector, branch list, member list, and merchant directory reuse these components. Forms remain feature-owned because their fields, validation, and mutation behavior are domain-specific.

## Remaining refactor parts

The authenticated frontend refactor is complete. No additional product features or business rules were introduced by this work.

## Final validation

The final audit covered authenticated page responsiveness, keyboard and screen-reader behavior, repeated request patterns, and design-system consistency.

- Organization tabs remain directly accessible in DOM order and scroll horizontally on narrow screens without moving or hiding destinations.
- Organization navigation is owned by the persistent route layout and appears as a left sidebar on desktop. It falls back to the same horizontally scrollable destinations on narrow screens.
- Active navigation continues to use `aria-current="page"`; conditional links remain aligned with the existing role rules.
- Structural loading states announce status and decorative skeleton rows remain hidden from assistive technology.
- Organization creation now moves focus to the invalid name field after client-side validation.
- Space list loading, retry, and success feedback now use the same patterns as the other operational pages.
- Tenant organization data is fetched only by the persistent organization provider, and branch requests remain lazy, cached, and deduplicated.
- Feature-specific requests remain scoped to the page that needs them; no global cache or state dependency was added.

The assignment and agreement features were implemented after this refactor and are covered by the overall [Milestone 3 completion](./completion.md).

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
