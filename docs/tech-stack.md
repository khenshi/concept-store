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
- Prisma for database access and migrations
- Zod for environment configuration validation
- `class-validator` and `class-transformer` for NestJS request DTO validation
- Jest for unit tests
- Supertest for HTTP integration tests
- ESLint and Prettier

NestJS DTO decorators are retained because they work directly with the framework's global `ValidationPipe` and can support future OpenAPI generation. Zod is used for environment parsing, where its inferred types and explicit parsing model are a better fit. This split can be revisited if maintaining two validation approaches creates measurable duplication.

## Authentication and authorization

- bcrypt for password hashing
- short-lived JWT access tokens for the current authentication foundation
- NestJS guards for authenticated and authorized access
- organization membership and role-based authorization will be introduced only in their assigned Milestone 1 parts

Rotating refresh tokens, session revocation, password recovery, email verification, and MFA remain undecided or out of the current scope.

## Frontend direction

The frontend has not yet been initialized. The agreed direction from the project architecture is:

- Next.js
- React
- TypeScript
- Tailwind CSS
- browser/PWA delivery
- IndexedDB for offline POS persistence when Milestone 8 is assigned

Additional frontend libraries, including component, form, server-state, and testing libraries, should be selected as part of frontend initialization rather than treated as already implemented.

## Deferred infrastructure

- S3-compatible object storage only when file or image storage is required
- Redis only when a demonstrated caching, queue, or distributed-lock requirement exists
- external payment providers only when explicitly assigned
- deployment and hosting providers remain undecided

The project does not currently use microservices, message brokers, event sourcing, or separate databases per tenant.
