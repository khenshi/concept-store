# Foundation Rollback

**Status:** Implemented and verified on `main`
**Date:** September 11, 2026

Kapwesto was rolled back across frontend, backend, database schema and demo
data, and documentation to the Milestone 1 multi-tenant foundation.

The active system retained authentication, account settings, organizations,
branches, memberships and RBAC, organization invitations, tenant isolation,
security infrastructure, and the shared application shell. All later business
modules, their frontend components and routes, backend services and APIs,
database entities and migrations, tests, scripts, and current-behavior
documentation were removed.

The complete pre-rollback state, including work that had not been committed on
`main`, is preserved locally at branch
`archive/pre-foundation-rollback-2026-09-11` (archive commit `2c1554b`).

Every later milestone requires a new decision-complete plan before code or data
structures are reintroduced.
