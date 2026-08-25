# Frontend Organization Entry

## Scope

This Milestone 1 part connects authenticated users to the existing organization APIs. It provides:

- membership-scoped organization listing
- organization creation
- organization selection
- server-validated organization workspace entry
- loading, empty, validation, and API error states

Branch management, member administration, persisted active-organization preferences, and role-specific dashboards are excluded.

## Routes and behavior

### `/app`

Loads `GET /organizations` through the authenticated request client. Only organizations returned for the current authenticated membership are displayed.

The creation form sends `POST /organizations`. Names are trimmed and validated as 2–120 characters, matching the backend. A successful creation navigates directly to the new organization workspace.

The workspace selector presents search and creation controls beneath the page introduction. Search filters the already-loaded membership-scoped organization list without another API request. Organization cards use a responsive one-, two-, and three-column grid. Organization creation opens a focused modal, and a successful request navigates directly to the created organization's overview route.

### `/app/organizations/:organizationId`

Loads `GET /organizations/:organizationId` before displaying the selected workspace. The backend membership check remains authoritative; placing or changing an organization UUID in the URL does not grant tenant access.

The page is intentionally a neutral workspace confirmation. Branch tools and role-specific navigation belong to subsequent parts.

## State and security decisions

- The organization ID is represented in the route, not stored as trusted authorization state.
- No active organization is persisted in local storage or added to authentication tokens.
- All organization requests use the shared authenticated client and its access-token refresh behavior.
- Client route protection and visibility are convenience controls only; backend membership and RBAC checks remain authoritative.
- User-visible roles come only from backend organization responses.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
