# Concept Store Frontend

Next.js application for the Concept Store Management System foundation. The current interface covers authentication, accounts, organizations, branches, memberships, and invitations; later business modules are intentionally absent.

## Requirements

- Node.js 20.9 or newer
- Running Concept Store backend for future integration

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_URL` to the backend origin.
3. Install dependencies with `npm install`.
4. Start development with `npm run dev`.

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
