# Milestone 2: Merchant Data Model

## Scope

This part introduces the PostgreSQL and Prisma foundation for organization-owned merchants. It includes the merchant profile, lifecycle status, tenant relationship, indexes, and database migration only.

Merchant APIs, account access, frontend screens, spaces, agreements, products, inventory, sales, and settlements are not implemented by this part.

## Merchant model

| Field            | Required | Purpose                                             |
| ---------------- | -------- | --------------------------------------------------- |
| `id`             | Yes      | Globally unique merchant record identifier          |
| `organizationId` | Yes      | Tenant that owns the merchant                       |
| `name`           | Yes      | Merchant brand or business display name             |
| `code`           | No       | Stable organization-specific operational identifier |
| `contactName`    | Yes      | Primary contact person                              |
| `email`          | Yes      | Primary contact email                               |
| `phone`          | Yes      | Primary contact telephone number                    |
| `status`         | Yes      | Current merchant lifecycle status                   |
| `createdAt`      | Yes      | Record creation time                                |
| `updatedAt`      | Yes      | Last profile update time                            |

Contact fields are required because merchants are created as active operational records. Each merchant must have an identifiable contact person, email address, and telephone number. Validation and normalization limits will be enforced by the API DTOs in the next backend part.

Partially completed merchant onboarding is not represented by nullable contact information. If the product later needs to save incomplete onboarding records, it should introduce an explicit draft workflow instead of weakening active merchant data requirements.

## Lifecycle status

`MerchantStatus` contains:

- `ACTIVE` — currently operating with the concept store
- `INACTIVE` — retained but not currently operating
- `SUSPENDED` — temporarily prevented from normal operation
- `ENDED` — the commercial relationship has ended

New records default to `ACTIVE`. Status is used instead of deleting merchants so later inventory, sales, agreements, and settlement history can retain a valid merchant relationship.

No status-transition workflow or history table is introduced yet. Those should be added only when a later business rule requires transition history or approval.

## Tenant and deletion rules

Every merchant has a required `organizationId` foreign key. All future merchant queries must scope by both organization and merchant identifiers; a merchant ID alone is never sufficient authorization.

The organization foreign key uses `ON DELETE RESTRICT`. Organization deletion is not part of the current system, and merchant records should not be silently removed because they will eventually anchor financially and operationally important history.

## Uniqueness and indexes

- `code`, when present, is unique within an organization.
- PostgreSQL permits multiple `NULL` codes, so a code remains optional.
- Merchant display names are not unique because separate businesses may legitimately share a name.
- `(organizationId, status)` supports tenant-scoped status filtering.
- `(organizationId, name)` supports tenant-scoped directory ordering and name lookup.

Code normalization will be enforced at the API boundary. Database uniqueness remains the final concurrency-safe constraint.

## Merchant records and user accounts

A merchant business record is not a `User`, and it is not the same concept as an organization membership with the `MERCHANT` role. This part intentionally adds no user or membership foreign key.

Merchant account linking requires explicit rules for whether one account may represent multiple merchant businesses and whether a merchant may have multiple account users. That relationship will be designed only when merchant self-access is assigned.

## Migration

Migration: `20260824010000_add_merchants`

The migration creates the `MerchantStatus` enum, `Merchant` table, tenant foreign key, tenant-scoped code constraint, and directory indexes.

## Validation

Run from `backend/`:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run build
npm run lint
npm test
```
