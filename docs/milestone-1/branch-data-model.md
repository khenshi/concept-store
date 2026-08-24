# Branch Data Model

## Scope

This Milestone 1 part adds the database foundation for organization-owned branches. It includes only the Prisma model and SQL migration.

It does not add branch APIs, DTOs, authorization, frontend screens, staff-to-branch assignments, store settings, inventory, POS devices, or sales.

## Model

Each `Branch` contains:

- UUID `id`
- required `organizationId`
- required `name`
- optional operational `code`
- structured address fields:
  - required `addressLine1`
  - optional `addressLine2`
  - required `city`
  - required `province`
  - optional `postalCode`
  - required two-character `countryCode`
- `createdAt` and `updatedAt` timestamps

The `Organization` model exposes the inverse `branches` relationship.

## Tenant and data-integrity rules

- Every branch belongs to exactly one organization.
- Every branch has the core address information required to identify a physical store location.
- Branch names are unique within an organization but may be reused by another organization.
- Non-null branch codes are unique within an organization but may be reused by another organization.
- Multiple branches may omit a code because PostgreSQL permits multiple `NULL` values in this unique constraint.
- The organization foreign key uses `ON DELETE RESTRICT`. Organization deletion is not currently supported, and branch records should not be silently removed before future branch-owned business history has an explicit retention policy.

Name, code, and address validation and normalization will be enforced by the DTO/service layer in the branch API part. Country codes will use uppercase ISO 3166-1 alpha-2 values. Database uniqueness remains case-sensitive with the current PostgreSQL schema.

## Migration

Migration: `20260824000000_add_branches`

It creates the `Branch` table with structured address columns, the two organization-scoped unique indexes, and the organization foreign key.

## Validation

Run from `backend/`:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run build
```

Applying the migration to a database is intentionally left to the developer review step:

```bash
npm run prisma:migrate:dev
```

## Assumptions and limitations

- A branch name is its required human-readable identity.
- A branch code is optional and intended for concise operational identification.
- Branch status is not introduced because no status lifecycle has been defined for Milestone 1.
- `addressLine2` remains optional because not every location has a unit, floor, or secondary address component.
- `postalCode` remains optional to avoid assuming that every supported country formats or requires one in the same way.
- Incomplete draft branches are not supported because no branch draft lifecycle exists in this milestone.
- Coordinates, maps, geocoding, delivery zones, and address-provider integrations are not included.
