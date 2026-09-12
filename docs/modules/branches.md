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

The directory uses full-width responsive rows with visible branch identity,
optional code, complete address, and a detail link. Debounced local search matches
name/code/address; a labeled location selector filters by city and province.
Empty, filtered-empty, loading, and request-error states remain distinct. Owners
and managers can add branches; cashiers and merchants remain read-only.

Creation and editing share a scroll-contained native modal. It focuses the form
heading, blocks background interaction, restores focus/scrolling on close, and
supports safe Escape/backdrop dismissal. Dismissal and repeat submission are
blocked while a write is pending. Field hints remain above inputs, and validation
connects messages and focuses the first invalid field.

The detail view uses the shared page header, information panel, and owner/manager
edit action. Successful create/edit operations update the workspace cache and
announce the affected branch. Edit requests still explicitly send `null` when
clearing optional code, second address line, or postal code. API scoping,
authorization, schema validation, and normalization are unchanged.
