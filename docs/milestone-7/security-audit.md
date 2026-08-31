# Milestone 7 Security Audit

## Authorization

- Owner/manager reporting routes use the existing authenticated organization
  guard and reject cashier and merchant roles.
- The merchant dashboard route accepts only the `MERCHANT` role.
- Merchant identity is derived from a server-side `MerchantAccount` link. The
  dashboard does not accept a merchant ID from the client.
- Only owners can create or replace merchant-account links.
- Only organization members with the `MERCHANT` role can be linked.
- Changing a linked member away from the merchant role deletes the access link.

## Tenant and object isolation

- Every report query includes the authenticated `organizationId`.
- Branch and merchant report filters are validated inside that organization
  before aggregation.
- `MerchantAccount` uses composite tenant foreign keys to both the organization
  membership and merchant record.
- A merchant record can be linked to at most one account in an organization.
- Missing links return a not-found response without falling back to mutable
  email matching.

## Financial integrity

- Report endpoints are read-only.
- Monetary aggregation uses PostgreSQL/Prisma decimal values rather than
  floating-point arithmetic.
- Approved and paid settlement snapshots are not recalculated by reports.
- Merchant dashboard responses omit store-revenue metrics and mixed-sale total
  records that could disclose another merchant's value.
- Detailed refund values are restricted to the selected reporting period.

## Validation coverage

- Tenant-scoped filter validation tests
- Reversed reporting-period validation
- Merchant account linking and role-transition cleanup tests
- Unlinked merchant dashboard rejection test
- Frontend tenant-scoped API path tests
- Backend lint, unit tests, build, and Prisma schema validation
- Frontend lint, type checking, tests, and production build
