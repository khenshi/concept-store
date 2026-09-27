# Sales Reports Ranking Controls

## Completed

Implemented ranking controls limited to the Sales Reports Rankings tab. Product
rankings support deterministic gross-sales or units-sold ordering, and
Owner/Manager users can filter by role-visible merchants. Merchant accounts
retain an own-products-only projection with both ranking metrics available.

The rankings API echoes the applied metric and merchant filter, validates tenant
and role scope, filters sale/refund item streams consistently, and preserves
server pagination and exact string totals. Merchant options load on demand from
the existing role-scoped merchant directory. Overview charts and report totals
remain unchanged.

Added DTO, service, HTTP/OpenAPI, PostgreSQL integration, frontend API/schema,
component, and workspace coverage. No schema, migration, or infrastructure
changes were required.
