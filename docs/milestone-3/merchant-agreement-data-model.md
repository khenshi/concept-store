# Milestone 3: Merchant Agreement Data Model

## Scope

This part adds the PostgreSQL and Prisma foundation for merchant commercial-agreement history.

It does not add agreement APIs, settlement calculations, payouts, automatic scheduling, frontend screens, or any Milestone 4 functionality.

## MerchantAgreement model

A merchant agreement belongs directly to an organization and one merchant in that organization. It represents commercial terms across the organization rather than terms for one branch or physical-space assignment.

| Field                | Required | Purpose                                                   |
| -------------------- | -------- | --------------------------------------------------------- |
| `id`                 | Yes      | Stable agreement-history identifier                       |
| `organizationId`     | Yes      | Tenant boundary                                           |
| `merchantId`         | Yes      | Merchant governed by the agreement                        |
| `startDate`          | Yes      | First effective business date                             |
| `endDate`            | No       | Final effective business date                             |
| `fixedRentAmount`    | No       | Fixed charge for each configured settlement period        |
| `commissionRate`     | No       | Percentage of attributable merchant sales                 |
| `settlementSchedule` | Yes      | Weekly, semi-monthly, or monthly settlement configuration |
| `status`             | Yes      | Draft, active, or ended lifecycle state                   |
| `createdAt`          | Yes      | Record creation time                                      |
| `updatedAt`          | Yes      | Last update time                                          |

Dates use PostgreSQL `DATE` because agreement terms are effective by business date. Fixed rent uses `numeric(12,2)` and commission percentage uses `numeric(5,2)` through Prisma `Decimal`; neither value uses floating-point storage.

## Commercial models

One model supports all initial arrangements:

- fixed rent only: `fixedRentAmount` is set
- commission only: `commissionRate` is set
- hybrid: both values are set

Fixed rent is one merchant-level charge per settlement schedule. It is not multiplied by space assignments and is not attached to a branch.

`SettlementSchedule` contains:

- `WEEKLY`
- `SEMI_MONTHLY`
- `MONTHLY`

`AgreementStatus` contains:

- `DRAFT`
- `ACTIVE`
- `ENDED`

## Database invariants

PostgreSQL enforces:

- `endDate` cannot precede `startDate`
- a provided fixed-rent amount must be greater than zero
- a provided commission rate must be greater than zero and no greater than 100
- an active agreement must contain fixed rent, commission, or both
- a merchant can have at most one agreement with `ACTIVE` status
- the merchant and agreement must belong to the same organization

Draft agreements may omit both commercial values while terms are being prepared. The API will validate lifecycle transitions and make active/ended history immutable where required in the next implementation part.

The one-active-agreement rule uses a partial unique index on `merchantId` where status is `ACTIVE`. Merchant IDs are globally unique, while the composite merchant foreign key independently guarantees tenant consistency.

## Relationships and deletion

`Organization` and `Merchant` expose agreement-history relations. Agreement foreign keys use restrictive deletion so merchant or organization changes cannot silently erase financial source terms that later settlements may reference.

The schema includes a composite agreement identifier keyed with `organizationId` to support tenant-safe downstream relationships when settlement records are introduced in their assigned milestone.

## Migration

Migration: `20260825000000_add_merchant_agreements`

The migration creates:

- `SettlementSchedule` and `AgreementStatus` enums
- the `MerchantAgreement` table
- precise decimal columns
- date, monetary-term, commission-rate, and activation constraints
- tenant-safe foreign keys and lookup indexes
- the partial unique active-agreement index

The migration is created but not automatically deployed. Apply it through the project's normal Prisma migration workflow after reviewing it and confirming the target database.

## Validation

Run from `backend/`:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run build
npm run lint
npm test
npm run test:e2e
npm run format:check
```
