# Milestone 2: Merchant Branch Assignments

## Scope

This part connects organization-owned merchants to the specific branches where they operate. It adds a tenant-safe many-to-many database relationship, requires branch selection during merchant creation, exposes complete branch-assignment replacement, returns branch summaries with merchant responses, and extends validation, Swagger, and tests.

Frontend behavior is documented separately in [frontend merchant branch assignments](frontend-merchant-branch-assignments.md).

## Relationship

```text
Organization
├── Branch
├── Merchant
└── MerchantBranch
    ├── Merchant
    └── Branch
```

A merchant still belongs directly to one organization through `Merchant.organizationId`. Branch assignments describe where that merchant currently operates.

This supports:

- one merchant assigned to exactly one branch
- one merchant assigned to multiple branches
- many merchants assigned to the same branch
- organization merchants that are not automatically present in every branch

## Tenant integrity

`MerchantBranch` stores `organizationId`, `merchantId`, and `branchId`.

Composite foreign keys require both referenced records to share the same organization:

- `(merchantId, organizationId)` references `Merchant(id, organizationId)`
- `(branchId, organizationId)` references `Branch(id, organizationId)`

This prevents cross-organization merchant/branch combinations at the database level, not only in application code.

The API also verifies every submitted branch ID against the trusted organization context before writing assignments. It returns one generic validation error if any branch is unavailable, without identifying another tenant's record.

## API behavior

Merchant creation now requires a unique, non-empty `branchIds` array containing UUIDs.

Branch assignments can be replaced through:

```text
PUT /organizations/:organizationId/merchants/:merchantId/branches
```

Request:

```json
{
  "branchIds": ["branch-uuid"]
}
```

The replacement runs in a database transaction. Validation, removal of prior assignments, creation of the replacement set, and retrieval of the updated merchant either complete together or fail together.

Merchant responses include branch summaries with `id`, `name`, and optional `code`, ordered by branch name.

## Minimum assignment rule

New active merchants must operate in at least one branch. Both merchant creation and branch replacement reject an empty branch list.

PostgreSQL foreign keys guarantee valid tenant relationships but cannot directly guarantee that every merchant has at least one child join row. The API transaction enforces this rule for supported writes.

This migration assumes there are no production merchant records yet. If merchant data exists before this migration is applied, those records must be assigned to at least one valid organization branch as a deployment backfill.

## Separation from physical spaces

`MerchantBranch` means the merchant operates in a branch. It does not identify the physical rack, shelf, booth, cabinet, or other space occupied by the merchant.

Milestone 3 will use `SpaceAssignment` for physical placement and assignment history. The two relationships remain separate because a merchant may be operationally associated with a branch before or between physical space assignments.

## Deletion and history

Merchant and branch foreign keys use restrictive deletion behavior. Removing a merchant from a branch deletes only the current join row through the supported replacement operation; it does not delete either business record.

Historical branch participation is not tracked in this milestone. Physical-space assignment history will be preserved separately in Milestone 3.

## Validation

The checks cover:

- unique, non-empty UUID branch arrays
- tenant-scoped branch verification
- atomic merchant creation with assignments
- atomic assignment replacement
- database-level composite tenant constraints
- branch summaries in merchant responses
- Swagger request and response schemas
- API-boundary role and validation behavior
