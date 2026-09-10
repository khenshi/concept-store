# System Overview

**Status:** Current foundation reference

Kapwesto is currently a modular-monolith, multi-tenant SaaS foundation for
concept-store organizations. The implemented domain is limited to users,
authentication sessions, organizations, memberships, invitations, and branches.

## Technology

- Frontend: Next.js, React, TypeScript, and Tailwind CSS
- Backend: NestJS and TypeScript
- Database: PostgreSQL through Prisma
- Authentication: short-lived JWT access tokens and rotating refresh sessions
- API reference: Swagger/OpenAPI in enabled environments
- Runtime protection: Helmet, origin-restricted CORS, request throttling, and Pino logging

The backend is authoritative for authentication, organization membership, role
authorization, and tenant scope. Future business modules are not present in the
active codebase and must be planned milestone by milestone.

## Active backend modules

- authentication, account profiles, password changes, sessions, and account deletion;
- organizations, organization switching, and membership-derived access;
- organization invitations and member role management; and
- organization-scoped branch creation, listing, retrieval, and editing.

Redis, queues, microservices, event streaming, separate tenant databases, and
other unassigned infrastructure remain deliberately deferred.
