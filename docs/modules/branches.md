# Branches

**Status:** Implemented

## Responsibilities

- Create, list, retrieve, and edit organization branches.
- Store branch identity and postal address information.

## API

```text
POST  /organizations/:organizationId/branches
GET   /organizations/:organizationId/branches
GET   /organizations/:organizationId/branches/:branchId
PATCH /organizations/:organizationId/branches/:branchId
```

## Authorization

- All organization members can list and retrieve branches.
- `OWNER` and `MANAGER` can create and edit branches.
- Organization membership and object scope are enforced by the backend.

## Data and rules

`Branch` belongs to one organization and contains name, optional code, address
lines, city, province, optional postal code, and a two-letter country code.

- Name and non-null code are independently unique within an organization.
- Codes are normalized to uppercase.
- Updates reject an empty body.
- Queries include `organizationId`; a foreign branch is returned as not found.
- Organization deletion is restricted while branches exist.

## Frontend

The organization workspace provides branch listing, creation, detail, and edit
flows with validation and request-state feedback.
