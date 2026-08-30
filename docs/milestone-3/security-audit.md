# Milestone 3 Security Audit

## Result

Milestone 3 passes the security review for spaces, assignments, and merchant agreements.

## Verified controls

- All routes require authentication, organization membership, and an owner or manager role.
- Spaces validate branch ownership within the organization before creation or listing.
- Assignment creation validates the organization, branch, space, merchant participation, space status, and date order inside a transaction.
- A partial unique database index enforces at most one current assignment per physical space, including concurrent requests.
- Assignment history remains tenant-scoped and cannot be rewritten as another organization's record.
- Agreement services scope every read and mutation by `organizationId` and validate merchant ownership.
- Database checks enforce agreement date order, rent/commission bounds, and complete active terms.
- A partial unique index permits only one active agreement per merchant.
- Only drafts can be edited, only complete drafts can activate, and only active agreements can end; replacement preserves historical terms.

## Evidence

- Unit suites cover tenant-scoped space, assignment, and agreement behavior plus conflict paths.
- Milestone 3 HTTP suites cover missing authentication, role denial, cross-organization concealment, and input transformation.
- Composite foreign keys bind spaces and agreements to records in the same organization.

## Residual risks

- A global audit-event module is intentionally deferred. Assignment and agreement records preserve domain history required by this milestone.
- Financial settlement calculations do not exist yet and must not infer current terms for finalized historical periods when introduced.

