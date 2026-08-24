# Milestone 2: Frontend Merchant Branch Assignments

## Scope

This part updates the merchant frontend for the tenant-safe branch relationship introduced by the backend. It includes branch selection during merchant creation, current branch visibility in the directory, assignment editing on merchant profiles, validation, operational states, API tests, and schema tests.

## Creation workflow

The new-merchant page loads the branches belonging to the selected organization. Owners and managers must select at least one operating branch before creating an active merchant.

Branch choices use labeled checkboxes because merchants may operate in one or multiple branches. Selecting exactly one checkbox creates a merchant that operates only in that branch while remaining directly owned by the organization.

If the organization has no branches, merchant creation is disabled and the interface links to branch management. This prevents presenting a form that the backend cannot accept.

## Existing merchants

The merchant directory includes the names of every currently assigned branch.

The merchant profile keeps branch assignments in a dedicated panel. Saving that panel sends the complete selected branch set to the backend replacement endpoint. Profile and lifecycle forms remain separate, matching the backend transaction boundaries and making the effect of each action explicit.

The branch-assignment form rejects an empty selection. Successful changes update the local merchant response and announce the outcome through status semantics.

## Authorization and tenant safety

Only owners and managers see or use merchant and branch-assignment controls. The frontend loads branch choices from the current organization path and never accepts arbitrary organization identifiers as form values.

The backend remains authoritative and revalidates every branch against the authenticated organization membership. Frontend filtering is a usability measure, not an authorization boundary.

## Domain distinction

- `Merchant.organizationId` identifies the concept-store organization/store owner that owns the merchant record.
- Merchant branch assignments identify the branches where the merchant currently operates.
- Future Milestone 3 space assignments identify the physical rack, shelf, booth, cabinet, or other space used inside a branch.

These concepts remain separate so a merchant can belong to one organization, operate in one or several branches, and later occupy one or several physical spaces.

## Validation

The frontend checks cover:

- required non-empty branch selection
- UUID branch values
- branch IDs in merchant creation requests
- dedicated branch replacement requests
- branch summaries in the merchant client model
- lint, typecheck, unit tests, production build, and formatting
