# Milestone 1: Frontend Initialization

## Scope

This part initializes the shared frontend application and its development infrastructure:

- Next.js App Router with React and TypeScript
- Tailwind CSS
- browser-visible environment validation with Zod
- ESLint and Prettier
- Vitest, Testing Library, and jsdom
- a minimal responsive application shell

It does not implement authentication UI, session storage, API calls, organization selection, membership administration screens, merchant features, branches, dashboards, or offline functionality.

## Application boundary

One frontend application will contain separate role-based route areas for store operations and merchants. Shared authentication, API handling, design primitives, and organization context will not be duplicated across separate applications.

The eventual POS may be reconsidered as a separate PWA when its offline requirements are assigned in Milestone 8.

## Environment

`NEXT_PUBLIC_API_URL` is required and must be an HTTP or HTTPS URL. Because variables prefixed with `NEXT_PUBLIC_` are embedded in browser code, this value must never contain credentials or secrets.

Create local configuration before starting or building:

```bash
cd frontend
cp .env.example .env.local
```

Next.js validates the environment while loading `next.config.ts`, causing development and production builds to fail early when configuration is missing or malformed.

## Structure

```text
frontend/
  src/
    app/                  App Router pages, layouts, and global styles
    config/               Environment parsing and tests
  vitest.config.mts       Unit and component test configuration
  vitest.setup.ts         Testing Library DOM matchers
```

Feature folders and role-based route groups will be added only when their vertical slices are implemented.

## Development commands

```bash
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Validation

This part includes tests for environment validation and the initial application shell. Formatting, lint, type-checking, tests, production build, and startup are verified before handoff.

Local development uses Next.js's default Turbopack development server. Production builds use Next.js's supported Webpack path because Turbopack's CSS worker requires an internal port that is unavailable in the managed build sandbox.

## Assumptions and limitations

- The frontend is intentionally a single application for both store operators and merchants.
- Authentication persistence will be designed in the next vertical slice before login UI is implemented.
- No backend CORS change is included in this frontend-only part.
- No deployment or hosting provider is selected.
