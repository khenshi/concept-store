# Milestone 1: Frontend Authentication Foundation

## Scope

This part adds the browser-side authentication foundation:

- typed authentication API contracts
- login and registration client methods
- in-memory access-token handling
- refresh-cookie session restoration
- coordinated refresh for concurrent unauthorized requests
- one-time retry after successful refresh
- logout and memory cleanup
- application-wide authentication provider

It does not add login or registration pages, form validation UI, protected route layouts, organization selection, membership screens, dashboards, or merchant features.

## Session model

The browser never reads the refresh token. It is managed by the browser as an HTTP-only cookie and sent using `credentials: "include"`.

The access JWT is held only in the `AuthClient` instance's private memory. It is not written to:

- `localStorage`
- `sessionStorage`
- IndexedDB
- readable cookies

Refreshing or closing the page clears the access token. On application mount, `AuthProvider` calls `POST /auth/refresh`; a valid refresh cookie restores the authenticated user and provides a new in-memory access JWT.

## Authentication state

The provider exposes:

```text
status: loading | authenticated | unauthenticated | error
user
error
login(credentials)
register(credentials)
logout()
request(path, options)
```

The root layout installs one provider for the shared store-operations and merchant application.

## API request behavior

Authenticated requests receive the current access JWT in the `Authorization: Bearer` header. Refresh cookies are included automatically but remain unreadable to JavaScript.

When an authenticated request receives HTTP `401`:

1. The client starts or joins one shared refresh operation.
2. A successful refresh replaces the in-memory access token.
3. The original request is retried once.
4. A failed refresh clears authentication state.

The one-retry limit prevents request loops. Coordinating concurrent failures also reduces the chance that multiple browser components rotate the same backend session simultaneously.

Backend JSON error messages are normalized into a typed `ApiError` containing the HTTP status and readable message.

## Development origin

The frontend development and production-start scripts use port `3001`, while `.env.example` points to the backend at `http://localhost:3000`. This matches the backend's default `FRONTEND_ORIGIN` configuration.

## Structure

```text
src/
  config/
    public-environment.ts
  features/auth/
    auth-client.ts
    auth-client.spec.ts
    auth-context.tsx
    auth-context.spec.tsx
    auth.types.ts
```

The API contracts are frontend-owned types rather than imports from backend implementation files. A generated OpenAPI client can replace them later if API generation is explicitly introduced.

## Validation performed

- Formatting and ESLint passed.
- TypeScript checking passed.
- All 10 frontend tests passed.
- The production build passed.
- Tests cover login request behavior, in-memory authorization, coordinated refresh, unauthenticated restoration, logout cleanup, backend error normalization, and provider restoration.

## Assumptions and limitations

- Authentication screens will use the provider methods in the next frontend part.
- Components must wait for restoration to leave `loading` before making protected requests or redirecting.
- The access token remains accessible to executing JavaScript while in memory; short expiry and avoiding persistent browser storage reduce, but cannot eliminate, XSS impact.
- Cross-tab refresh coordination is not implemented. Each tab has independent memory and may share the same refresh cookie; multi-tab coordination can be added if integration testing demonstrates a real conflict.
- Frontend authorization improves navigation and UX only. The backend remains authoritative for organization membership and roles.
