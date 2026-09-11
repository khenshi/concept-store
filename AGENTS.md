# AGENTS.md

## Project

This repository contains a multi-tenant SaaS Concept Store Management System.
It is developed incrementally as a modular monolith.

Only behavior documented under `docs/modules/` is implemented. The proposed or
approved work for the next change belongs in `docs/plans/current.md`. Archived
plans are historical records and never authorize implementation.

## Primary rule

Do not implement a feature, module, database entity, abstraction, integration,
or infrastructure component unless it is explicitly included in the approved
current plan.

For every task:

1. Inspect the current repository and relevant module documentation.
2. Read `docs/plans/current.md` and confirm that the requested work is approved.
3. Define the smallest complete scope and its explicit exclusions.
4. Preserve existing behavior and unrelated user changes.
5. Enforce authentication, authorization, tenant isolation, and data integrity.
6. Validate the result in proportion to its risk.
7. Update the affected file under `docs/modules/` after implementation.
8. Move completed or superseded plans into `docs/plans/archive/`.

Do not infer scope from product ideas, archived plans, old branches, or what a
full SaaS product might eventually need.

## System architecture

The application is a multi-tenant modular monolith:

```text
Next.js web application
        |
        v
NestJS HTTP API
        |
        v
Prisma -> PostgreSQL
```

Current technology:

- Frontend: Next.js, React, TypeScript, and Tailwind CSS.
- Backend: NestJS and TypeScript.
- Database: PostgreSQL through Prisma.
- Authentication: short-lived JWT access tokens and rotating refresh sessions.
- API reference: Swagger/OpenAPI in enabled environments.
- Runtime protection: Helmet, origin-restricted CORS, request throttling, and
  Pino logging.

PostgreSQL is the authoritative application datastore. Do not introduce Redis,
queues, event streaming, microservices, separate tenant databases, or other
infrastructure without an approved requirement.

## Multi-tenancy architecture

An organization represents one subscribed concept-store business and is the
tenant boundary. An organization may have multiple branches and members.

```text
Platform
└── Organization
    ├── Memberships
    ├── Invitations
    ├── Branches
    └── Approved organization-scoped modules
```

Tenant isolation is a critical invariant:

- Derive organization access from the authenticated user's membership.
- Never trust a client-supplied organization ID without authorization checks.
- Every tenant-owned query must include the active `organizationId`.
- Branch-owned records must also enforce `branchId` where applicable.
- Guessed IDs must never enable cross-organization access.
- Foreign tenant objects should use the same not-found behavior as absent objects.
- Validate that related records belong to the same organization.
- Prefer database constraints that make cross-tenant relationships impossible.
- Do not use a separate database per tenant unless explicitly approved.

## Roles and authorization

The existing organization roles are:

- `OWNER`
- `MANAGER`
- `CASHIER`
- `MERCHANT`

`PLATFORM_SUPERADMIN` is a product-level role only and is not implemented unless
documented in a module file.

Backend guards and service-level object checks are the authorization boundary.
Frontend visibility is only a usability measure. Do not trust roles, tenant IDs,
entity IDs, prices, totals, or other sensitive values supplied by the frontend
when the backend can derive or validate them.

Do not add advanced permission granularity without an approved plan.

## Backend architecture

Prefer:

- clear NestJS module boundaries;
- thin controllers;
- DTO validation and normalization at the API boundary;
- business logic in focused services;
- authorization close to business operations;
- tenant-scoped Prisma queries;
- database constraints for important invariants;
- transactions when multiple writes must succeed or fail together;
- predictable responses and descriptive error handling; and
- Swagger/OpenAPI contracts that match runtime responses.

Avoid:

- business logic in controllers;
- giant services;
- duplicated authorization logic;
- premature repository or generic abstractions;
- hidden side effects;
- unnecessary event-driven architecture; and
- broad refactors unrelated to the current plan.

## Frontend architecture

The Next.js application separates public, authentication, invitation, account,
and organization workspace routes. Authenticated organization pages share a
responsive organization shell and organization context.

Source boundaries:

```text
frontend/src/
├── app/                         Route entry points and layouts
├── config/                      Environment parsing and configuration
├── features/
│   └── <feature>/
│       ├── api/                 Backend communication
│       ├── components/          Feature-owned UI
│       └── model/               Types, schemas, and client state
└── shared/
    ├── components/              Domain-agnostic UI and branding
    └── hooks/                   Domain-agnostic React hooks
```

Frontend rules:

- Keep route modules thin and delegate behavior to feature components.
- A feature may use shared code and explicitly import another feature's public
  contract when a workflow requires it.
- Shared code must not import business features.
- Keep tests beside the source they validate.
- Mirror backend validation in client schemas for usability, while keeping the
  backend authoritative.
- Use semantic HTML, visible focus states, responsive layouts, and clear loading,
  empty, success, and error feedback.
- Follow the approved visual system in `DESIGN.md`: restrained emerald accents,
  slate neutrals, and clear operational hierarchy.

## Database rules

When changing the schema:

1. Protect tenant isolation.
2. Use foreign keys and database constraints where practical.
3. Add indexes for actual query patterns.
4. Define deletion behavior deliberately.
5. Preserve history only where the approved business behavior requires it.
6. Use transactions for multi-write consistency.
7. Avoid premature denormalization.
8. Store monetary values with precise decimal/numeric types, never floating point.
9. Do not store images or blobs in PostgreSQL without an explicit requirement.
10. Validate and generate the Prisma client after schema changes.

## Security rules

Every module must consider:

- authentication;
- role and object-level authorization;
- organization and branch isolation;
- strict input validation;
- secure password, token, and session handling;
- rate limiting where abuse risk warrants it;
- least privilege;
- safe error disclosure; and
- auditability for important actions.

DTO whitelisting must continue to reject unknown fields. Important workflows
need tests for unauthorized roles and cross-tenant access. Do not add a global
audit system unless the current plan requires one, but avoid designs that make
later auditing impossible.

## Planning and implementation workflow

### Inspect

Read the schema, relevant modules, authorization patterns, tests, module docs,
and current plan. Do not assume architecture that is not present.

### Define scope

State what is being built, what is excluded, and which existing modules it
depends on. Ask before implementing ambiguity that materially changes business
behavior or data integrity.

### Design

Determine only what the approved work requires:

- entities and relationships;
- business rules and constraints;
- API routes and DTOs;
- service responsibilities;
- authorization requirements;
- transaction boundaries; and
- important edge cases.

### Implement

Build the smallest complete version. Prefer straightforward, maintainable code
over generalized frameworks. Do not rewrite, rename, or remove unrelated code.

### Validate

Run the applicable Prisma validation, formatting, linting, type checking, unit
tests, integration/e2e tests, and builds. Fix failures introduced by the work.

### Document

Update the relevant `docs/modules/<module>.md` with implemented behavior, API
routes, authorization, business rules, schema changes, and important design
decisions. Module documentation describes current behavior, not proposed work.

## Definition of done

A task is complete when:

- the approved behavior is implemented;
- tenant isolation and authorization are enforced;
- important invariants and edge cases are covered;
- database changes are valid;
- applicable checks pass;
- module documentation reflects the implementation; and
- no unrelated or excluded feature was added.

Use this priority order:

```text
Correctness
  -> Security and tenant isolation
  -> Data consistency
  -> Maintainability
  -> Simplicity
  -> Performance
  -> Convenience
```
