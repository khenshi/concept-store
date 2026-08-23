# Frontend Authentication UI

## Scope

This Milestone 1 part connects the existing frontend authentication client to a usable interface:

- registration and login pages
- client-side Zod validation
- server error feedback and submission states
- guest-only and authenticated route gates
- logout from a minimal authenticated landing page

Organization selection, organization creation, branch administration, and role-specific dashboards are intentionally excluded.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product entry page with authentication links |
| `/login` | Guest | Sign in with email and password |
| `/register` | Guest | Create an account with email and password |
| `/app` | Authenticated | Neutral post-authentication landing page |

Authenticated visitors to guest routes are redirected to `/app`. Visitors without an authenticated session who request `/app` are redirected to `/login`. These client-side gates improve navigation but do not replace backend authorization.

## Validation and security

- Registration requires a valid email and a 12–128 character password, matching the backend contract.
- Login accepts any non-empty password so the form does not impose stronger rules on existing credentials.
- Field errors are connected to inputs with accessible descriptions.
- Authentication failures are shown without storing access tokens in browser persistence.
- The backend remains responsible for credentials, session validity, authorization, and tenant isolation.

## Structure

- `src/app/(auth)` contains guest authentication routes.
- `src/app/(protected)` contains routes requiring a restored session.
- `src/features/auth/credentials-form.tsx` owns login and registration form behavior.
- `src/features/auth/auth-gate.tsx` owns route gating based on the shared auth provider.
- `src/features/auth/auth.schemas.ts` owns UI validation contracts.

## Validation performed

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```

## Assumption

All authenticated users currently arrive at `/app`. Selecting an organization and routing into owner/staff/merchant experiences belongs to the next implementation part, after the relevant organization APIs are connected.
