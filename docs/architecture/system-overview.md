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
