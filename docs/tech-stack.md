# Technology Stack

This document records the agreed technology direction for the Concept Store Management System. Technologies marked as deferred are not permission to implement them before their assigned milestone.

## Repository

- Single repository with separate `backend/`, `frontend/`, and `docs/` directories
- npm for package management
- TypeScript across the backend and frontend

## Backend

- NestJS modular monolith
- REST APIs with JSON
- PostgreSQL as the source-of-truth database
- Prisma 7 for database access and migrations
- Prisma's PostgreSQL driver adapter for direct database connections
- Zod for environment configuration validation
- `class-validator` and `class-transformer` for NestJS request DTO validation
- Jest for unit tests
- Supertest for HTTP integration tests
- ESLint and Prettier

NestJS DTO decorators are retained because they work directly with the framework's global `ValidationPipe` and can support future OpenAPI generation. Zod is used for environment parsing, where its inferred types and explicit parsing model are a better fit. This split can be revisited if maintaining two validation approaches creates measurable duplication.

## Authentication and authorization

- bcrypt for password hashing
- short-lived JWT access tokens held by the frontend in memory
- rotating opaque refresh tokens in secure HTTP-only cookies
- hashed, revocable refresh sessions stored in PostgreSQL
- NestJS guards for authenticated and authorized access
- organization membership and role-based authorization for tenant operations

Password recovery, email verification, MFA, and global session administration remain out of the current scope.

## Frontend

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zod for browser-visible environment validation and future form schemas
- Vitest, Testing Library, and jsdom for component and unit tests
- ESLint and Prettier
- React context for the initial authentication state boundary
- browser/PWA delivery
- IndexedDB for offline POS persistence when Milestone 8 is assigned

The store-operations and merchant experiences will use separate route areas within one frontend application. Additional component, form, and server-state libraries will be selected only when their first feature requires them.

## Deferred infrastructure

- S3-compatible object storage only when file or image storage is required
- Redis only when a demonstrated caching, queue, or distributed-lock requirement exists
- external payment providers only when explicitly assigned
- deployment and hosting providers remain undecided

The project does not currently use microservices, message brokers, event sourcing, or separate databases per tenant.
