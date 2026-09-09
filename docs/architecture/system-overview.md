# System Overview

**Status:** Current reference

Concept Store is a modular-monolith, multi-tenant SaaS application for concept
store operations. An organization represents one subscribed concept-store
business and owns its branches, merchants, spaces, products, inventory, sales,
settlements, and reports.

## Technology

- Frontend: Next.js, React, TypeScript, and Tailwind CSS
- Backend: NestJS and TypeScript
- Database: PostgreSQL through Prisma
- Authentication: short-lived JWT access tokens and rotating refresh sessions
- API reference: generated Swagger/OpenAPI documentation
- Runtime logging: Pino through `nestjs-pino`, with Prisma query events

NestJS DTOs use `class-validator` and `class-transformer`; environment parsing
uses Zod. Jest and Supertest cover backend behavior, while Vitest, Testing
Library, and jsdom cover frontend behavior. ESLint and Prettier are shared
quality gates.

The repository contains separate `frontend` and `backend` applications. The
backend is authoritative for authorization, prices, inventory changes,
financial calculations, and tenant scope.

## Module boundaries

The backend is organized around business capabilities:

- authentication and sessions;
- organizations, memberships, invitations, and branches;
- merchants, spaces, assignments, and agreements;
- products and branch inventory;
- POS sales, payments, and refunds;
- settlements and payouts; and
- reporting dashboards.

Controllers validate transport input and delegate to services. Services own
business rules and transaction boundaries. Prisma and PostgreSQL enforce
important relationships, uniqueness rules, and financial precision.

## Domain flow

```text
Merchant
  → Branch participation and space assignment
  → Commercial agreement
  → Products and branch inventory
  → Customer sale and merchant attribution
  → Refunds, rent, and commission
  → Settlement approval
  → Merchant payout
  → Operational reporting
```

## Deliberately deferred infrastructure

The project does not currently require Docker, Redis, queues, microservices,
event streaming, or separate databases per tenant. Infrastructure should be
introduced only when a concrete operational requirement justifies it.

Offline POS and SaaS billing remain future roadmap milestones.

## Development request and query logs

Starting the backend with `npm run start:dev` prints each completed HTTP request
and each Prisma query to the same terminal by default in development. HTTP logs
include a request ID, method, sanitized URL, response status, and elapsed time.
Database logs include SQL, execution time, and the database target. Query
parameters are deliberately excluded because they may contain credentials,
personal data, or financial input.

The behavior is controlled through these backend environment variables:

```text
LOG_LEVEL=debug
LOG_HTTP_REQUESTS=true
LOG_DB_QUERIES=true
LOG_DB_QUERY_PARAMETERS=false
```

Set either request or query logging to `false` when the output is too noisy.
Only enable `LOG_DB_QUERY_PARAMETERS` temporarily against safe development data;
never enable it for production or shared logs. Production defaults request and
query logging to off unless explicitly configured, and emits structured JSON
instead of development pretty-printing when logging is enabled.

Clients may send `X-Request-Id` to correlate a request with application logs.
Missing or excessively long IDs are replaced by a generated UUID. Sensitive URL
parameters and standard authentication fields are redacted from request logs.
