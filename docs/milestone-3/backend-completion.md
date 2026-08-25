# Milestone 3 Backend Completion

## Result

The Milestone 3 backend is complete. It represents branch-owned physical spaces, current and historical merchant occupancy, and organization-level merchant commercial agreements.

This completion covers the backend only. The Milestone 3 frontend remains a separate next phase.

## Implemented capabilities

### Spaces

- branch-owned spaces with branch-unique operational codes
- rack, shelf, cabinet, booth, table, drawer, and custom space types
- active and inactive operational status
- conditional custom-type validation
- tenant-scoped create, list, detail, and update APIs
- owner and manager authorization

### Space assignments

- merchant assignment to an active physical space
- current and historical occupancy records
- one current merchant assignment per space
- required current merchant participation in the same branch
- explicit assignment ending with preserved history
- concurrency-safe assignment creation and ending
- safe branch-participation removal only after current occupancy ends

### Merchant agreements

- draft, active, and ended lifecycle
- fixed-rent, commission-only, and hybrid commercial terms
- weekly, semi-monthly, and monthly settlement configuration
- precise decimal storage and validation
- one active organization-level agreement per merchant
- immutable active and ended commercial terms
- new-agreement renewal and extension history
- manual activation for future-dated drafts
- atomic replacement of an existing active agreement
- explicit agreement ending

## API surface

```text
POST   /organizations/:organizationId/branches/:branchId/spaces
GET    /organizations/:organizationId/branches/:branchId/spaces
GET    /organizations/:organizationId/spaces/:spaceId
PATCH  /organizations/:organizationId/spaces/:spaceId

POST   /organizations/:organizationId/spaces/:spaceId/assignments
GET    /organizations/:organizationId/spaces/:spaceId/assignments
PATCH  /organizations/:organizationId/space-assignments/:assignmentId/end

POST   /organizations/:organizationId/merchants/:merchantId/agreements
GET    /organizations/:organizationId/merchants/:merchantId/agreements
GET    /organizations/:organizationId/merchant-agreements/:agreementId
PATCH  /organizations/:organizationId/merchant-agreements/:agreementId
PATCH  /organizations/:organizationId/merchant-agreements/:agreementId/activate
PATCH  /organizations/:organizationId/merchant-agreements/:agreementId/end
```

All endpoints are published through the existing Swagger/OpenAPI setup.

## Security and integrity

- Every route requires authentication and stored organization membership.
- Only `OWNER` and `MANAGER` roles can manage Milestone 3 records.
- Every business lookup includes the trusted organization context.
- Branch IDs for assignments are derived from the trusted space record.
- Tenant-safe composite foreign keys prevent cross-organization relationships.
- Database check constraints protect dates and commercial values.
- Partial unique indexes enforce one current assignment per space and one active agreement per merchant.
- Financial values use PostgreSQL numeric types through Prisma Decimal.
- Lifecycle replacements use database transactions.

## Completion correction

The final integration audit separated historical `SpaceAssignment` records from mutable current `MerchantBranch` rows.

Keeping a historical foreign key to `MerchantBranch` would have prevented removing a merchant from a branch forever after any assignment, even after occupancy ended. The correction migration removes that dependency. The service still requires current branch participation when creating an assignment and now blocks branch removal only while a current assignment exists there.

Assignment creation and branch-participation replacement use serializable transactions so concurrent creation and removal cannot bypass that current-participation rule.

Assignment ending also uses a conditional update so simultaneous requests cannot overwrite a previously recorded end date.

Correction migration:

```text
20260825010000_decouple_assignment_history_from_merchant_branch
```

## Migrations

Milestone 3 adds:

```text
20260824030000_add_spaces_and_assignments
20260825000000_add_merchant_agreements
20260825010000_decouple_assignment_history_from_merchant_branch
```

Migrations are versioned but are not automatically deployed by implementation tasks. Review and apply them through the normal Prisma migration workflow for the target environment.

## Confirmed business decisions

- Fixed rent belongs to the organization-level merchant agreement and represents one charge per settlement period.
- A merchant can have only one active commercial agreement across the organization.
- Renewals, extensions, and active-term changes create a new agreement record.
- Future-dated agreements remain drafts until manually activated on or after their Philippine business start date.
- Full historical date-range overlap scheduling for spaces is deferred because the current API creates only open assignments and explicitly ends them.

## Explicit exclusions

Milestone 3 does not implement products, inventory, POS, settlement calculations, payouts, reporting, automatic agreement scheduling, merchant self-service, offline functionality, subscription billing, or frontend screens.

## Validation

The completion check runs:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run format:check
git diff --check
```
