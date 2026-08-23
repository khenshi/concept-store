# Milestone 1: Backend Initialization

## Scope

This part initializes the backend infrastructure required to begin Milestone 1. It does not implement authentication, organizations, users, branches, RBAC, tenant isolation behavior, or any later business domain.

## Technology

- NestJS 11
- TypeScript
- PostgreSQL
- Prisma 7
- Zod environment validation
- Jest and Supertest
- ESLint and Prettier

## Requirements

- Node.js 22 or newer
- PostgreSQL

## Setup

Run commands from the `backend/` directory:

1. Copy `.env.example` to `.env` and update `DATABASE_URL`.
2. Install dependencies with `npm install`.
3. Start PostgreSQL and create the configured database.
4. Validate the Prisma schema with `npm run prisma:validate`.
5. Start the API with `npm run start:dev`.

The API listens on `PORT`, which defaults to `3000`. `GET /` returns `{ "status": "ok" }` as a minimal process status response.

## Backend structure

```text
backend/
  prisma.config.ts                Prisma CLI datasource configuration
  prisma/                         Prisma schema and future migrations
  src/
    config/                       Runtime configuration validation
    infrastructure/database/     Shared Prisma database integration
    app.module.ts                 Root composition module
    main.ts                       Application bootstrap and global validation
  test/                           End-to-end tests
```

Future domain modules will be added under `backend/src/modules/<domain>` only when assigned by the active milestone.

## Configuration and safety

The application validates configuration during startup. `DATABASE_URL` is required and must use a PostgreSQL URL. `NODE_ENV` accepts `development`, `test`, or `production`, and `PORT` must be a valid network port.

Global DTO validation strips unknown properties, rejects non-whitelisted input, and transforms supported input types. Prisma connects through the PostgreSQL driver adapter during NestJS module initialization and disconnects during graceful shutdown. Migration commands read their connection URL from `prisma.config.ts`; the Prisma schema does not contain a datasource URL.

The Prisma schema intentionally contains no business models. Those entities will be introduced only by their assigned Milestone 1 parts.

## Development commands

```bash
npm run start:dev
npm run format:check
npm run lint
npm test
npm run test:e2e
npm run prisma:validate
npm run build
```

## Validation performed

- formatting check passed
- ESLint passed without warnings
- unit tests passed
- HTTP end-to-end test passed
- Prisma schema validation passed
- production build passed
- compiled application started against PostgreSQL and returned the expected status response

## Known issue

At initialization time, `npm audit` reported three high-severity advisories in Prisma CLI's development dependency chain through `deepmerge-ts`. npm recommended a forced Prisma downgrade, so no automatic breaking dependency change was applied. This should be reviewed during dependency maintenance.
