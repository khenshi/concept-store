# Milestone 2: Backend Completion

## Scope

The Milestone 2 backend allows concept-store organizations to centrally manage merchant businesses. It includes:

- organization-owned merchant records
- required merchant contact information
- optional tenant-unique merchant codes
- merchant lifecycle status
- create, list, search, retrieve, update, and status operations
- owner and manager authorization
- tenant isolation
- Swagger/OpenAPI documentation
- unit and API-boundary e2e coverage

## Domain boundary

A merchant represents an independent brand or business operating inside a concept store. It belongs to exactly one organization at this milestone.

A merchant record is not a user account and is not automatically linked to a user holding the `MERCHANT` organization role. Merchant account linking remains excluded until the product defines whether one merchant can have multiple users and whether one user can represent multiple merchant businesses.

## Data integrity

Every merchant requires:

- display name
- contact person
- contact email
- contact phone number
- lifecycle status

The optional merchant code is unique within an organization and normalized at the API boundary. Merchant names are not unique because independent businesses can legitimately share a display name.

Merchant records cannot be hard-deleted through the API. The `ENDED` status preserves identity for later agreements, products, sales, settlements, and payouts.

## Security and tenant isolation

All merchant endpoints require both authentication and stored organization membership. The backend derives organization context from the authenticated user rather than trusting an organization ID as authorization.

Owners and managers can access merchant management. Cashiers and merchant-role members cannot. Users without membership receive not found, which avoids revealing another tenant's organization.

Merchant reads and writes always include `organizationId`. A valid merchant ID from another organization cannot be used to retrieve or mutate the record.

## API behavior

The backend supports:

- merchant creation
- deterministic merchant listing
- optional case-insensitive profile/contact search
- optional status filtering
- merchant detail retrieval
- partial profile updates
- dedicated lifecycle status updates

Status changes currently allow movement between any defined statuses. Transition restrictions and status-history records are deferred until a concrete business workflow requires them.

Pagination is deferred until expected directory size and client requirements justify a stable pagination contract.

## Validation evidence

The backend completion gate covers:

- Prisma schema formatting, generation, and validation
- TypeScript production build
- lint and formatting
- unit tests for tenant scoping, filtering, validation, updates, and conflicts
- e2e tests through Nest controllers, validation pipes, JWT guards, organization guards, and role metadata
- OpenAPI merchant route and response-schema generation

The API-boundary tests verify unauthenticated rejection, cross-organization concealment, cashier and merchant-role denial, owner and manager access, query normalization, required contact fields, profile normalization, nullable code clearing, and lifecycle status updates.

## Explicit exclusions

Milestone 2 backend completion does not include merchant invitations or login, merchant self-service access, multiple merchant contacts, addresses, files, spaces, agreements, products, inventory, POS, settlements, payouts, reporting, or frontend screens.

The Milestone 2 frontend is the next phase and will consume this completed API without changing its authorization boundary.
