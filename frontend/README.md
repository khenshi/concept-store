# Concept Store Frontend

Next.js application for the Concept Store Management System foundation. The current interface covers authentication, accounts, organizations, branches, memberships, and invitations; later business modules are intentionally absent.

## Requirements

- Node.js 20.9 or newer
- Running Concept Store backend for future integration

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_URL` to the backend origin for direct local mode, or to
   the frontend origin plus `/api` when using the same-origin proxy. In proxy
   mode, also set the server-only `NEXT_API_UPSTREAM_URL` to the fixed backend
   origin; never put that value in a `NEXT_PUBLIC_` variable.
3. Install dependencies with `npm install`.
4. Start development with `npm run dev`.

Production `npm run start` keeps the local default port at `3001` and honors a
host-provided `PORT` when one is assigned. The same-origin proxy forwards
`/api/<path>` to the configured upstream origin without accepting a client URL.

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Structure

```text
src/
  app/                         Next.js routes, layouts, and route-level styles
  config/                      Validated frontend environment configuration
  features/
    <feature>/
      api/                     Backend clients and their contract tests
      components/              Feature-owned UI and page compositions
      model/                   Types, schemas, and feature state
  shared/
    components/                Reusable, domain-agnostic UI and branding
    hooks/                     Reusable React hooks
```

Keep route files thin: they should compose feature components instead of owning
business behavior. Feature-specific code stays inside its feature; only code
that is genuinely reusable across domains belongs in `shared`. Tests are
co-located with the implementation they exercise.

## Refund workflow checks

The focused return/refund feature lives in `src/features/refunds/`, composed into
existing authorized sale detail. Run `npm test -- src/features/refunds` for strict
staff/merchant contracts, all-page remaining quantities, live validation, explicit
manual-money confirmation, locked unchanged-request recovery and read-only retry
tests. Report refund/net presentation tests live beside Reports components.

Attempts are memory-only and scoped to organization plus authenticated user; there
are no persistent/offline refund drafts. jsdom models dialog open/close only and
does not verify native focus containment, responsive layout or rendered zoom.
New refund screens require their own browser QA or explicit waiver in final review.
