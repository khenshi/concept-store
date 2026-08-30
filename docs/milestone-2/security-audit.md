# Milestone 2 Security Audit

## Result

Milestone 2 passes the security review for merchant management.

## Verified controls

- Every merchant controller route requires authentication, organization membership, and an owner or manager role.
- Services use the trusted organization context from the guard; client input cannot select a different tenant for writes.
- Merchant reads and mutations include `organizationId`, so guessed IDs from another organization are concealed as not found.
- Merchant-to-branch participation validates that every branch belongs to the same organization.
- Composite database foreign keys prevent a merchant from being connected to a branch in another organization.
- Merchant codes are unique within an organization and request DTOs constrain names, codes, contact details, status, and branch IDs.
- Multi-branch replacement is transactional, avoiding partially updated participation.

## Evidence

- Merchant service tests verify tenant-scoped queries, branch validation, conflicts, and transaction behavior.
- Milestone 2 HTTP tests verify authentication, RBAC, organization isolation, and validated controller input.

## Residual risks

- Merchant self-service access is not part of Milestone 2. Current routes deliberately remain owner/manager-only.
- Merchant deletion is not implemented; status changes preserve business references and history.

