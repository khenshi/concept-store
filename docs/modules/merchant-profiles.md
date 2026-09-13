# Merchant Profiles

**Status:** Implemented

## Responsibilities

- Maintain organization-owned merchant business and contact profiles.
- List, search, filter, retrieve, and edit merchant identity information.
- Preserve merchant records while changing their lifecycle status.

This module establishes merchant identity only. It does not provide merchant
separate merchant authentication, products, inventory, sales,
payments, commercial agreements, settlements, or deletion.

## API

```text
POST  /organizations/:organizationId/merchants
GET   /organizations/:organizationId/merchants?q=&status=
GET   /organizations/:organizationId/merchants/:merchantId
PATCH /organizations/:organizationId/merchants/:merchantId
PATCH /organizations/:organizationId/merchants/:merchantId/status
```

List responses are ordered by merchant name and then ID. The optional `q`
parameter searches name, code, contact name, email, and phone
case-insensitively. The optional `status` parameter applies an exact lifecycle
filter. Results are not paginated.

## Authorization and tenant isolation

- Every route requires authentication and organization membership.
- Only owners create/edit/change lifecycle. Managers read identity/status summaries
  of merchants represented in assigned branches, without contact details.
- Linked MERCHANT members read their own profile including own contact details.
  Cashiers cannot use merchant routes. Unlinked merchants receive empty lists.
- Manager search uses name/code only, not hidden contact fields.
- `organizationId` is derived from the authenticated organization context and
  is never accepted in a request body.
- Every merchant query includes the active `organizationId`.
- Retrieval and mutation resolve the merchant within the active organization.
- Missing and foreign-organization merchant IDs return the same `404` response.
- Malformed organization and merchant UUIDs return `400`.

Frontend role-aware visibility is a usability feature and is not an
authorization boundary.

## Data model

`Merchant` belongs to one organization and contains:

- UUID-formatted ID and organization ID;
- business name and optional organization-scoped code;
- contact name, optional email, and required phone; and
- `ACTIVE`, `INACTIVE`, `SUSPENDED`, or `ENDED` lifecycle status.

Status defaults to `ACTIVE`. Merchant names are not unique. A non-null code is
unique within its organization and may be reused in another organization. The
schema provides composite uniqueness for `(id, organizationId)`, indexes for
organization/status and organization/name queries, and restricts organization
deletion while merchant records exist.

There is no merchant deletion operation. `ENDED` retains the profile for later
historical relationships.

The separate [Products](products.md) backend now references merchant identity with
a tenant-safe composite foreign key. New products, placements, and receipts
require an active merchant. Changing merchant status does not modify existing
products, branch prices, balances, or movement history.

## Validation and normalization

- Name and contact name are trimmed and contain 2–120 characters.
- Optional code is trimmed, uppercased, contains 2–32 characters, and permits
  uppercase letters, numbers, and internal hyphens only.
- Optional email is trimmed, lowercased, valid, and at most 254 characters.
- Phone is trimmed, contains 7–30 characters, and must be a valid Philippine
  mobile or landline number. User-readable formatting is preserved.
- Create requests cannot set status; new merchants are active.
- Profile updates reject empty bodies and cannot change status.
- Status changes use the dedicated status endpoint.
- Unknown request fields are rejected by global DTO whitelisting.
- Duplicate organization-scoped codes return `409` without exposing another
  tenant's records.

## Frontend

Merchant-profile links are owner-managed through membership APIs, not separate
merchant authentication. Only owners see creation/editing/lifecycle controls.
Managers read represented identity/status summaries with no contact fields; their
search prompt is business/code only. Runtime parsing strips contacts from manager
responses. Merchants read their linked profile, including their own contacts, with
no mutation actions; inactive profiles remain readable. Empty access explains
asking an owner to configure the link or placements. Role/organization/profile
changes reset screen state; obsolete reads and failed refreshes do not retain
actionable profiles.

Owners, managers, and merchants receive a `Merchants` organization-navigation destination.
The directory provides debounced server-side search, lifecycle filtering,
loading and error feedback, empty states, status badges, and profile links.

Creation opens in an accessible, scroll-contained modal. The shared create/edit
form provides 300 ms debounced validation after input, immediate validation on
blur, and final validation on submit. The profile page displays business and
contact information, supports profile editing, and keeps lifecycle changes in a
separate confirmed action.

Cashiers are not shown merchant navigation and direct screens do not request data.

The directory uses full-width responsive linked rows rather than a wide table.
Profile panels, lifecycle badges, and create/edit controls follow the neutral
design system. The wide native creation dialog restores focus and scrolling when
closed and prevents Escape/backdrop dismissal during a pending save. Interactive
controls retain visible focus rings; programmatically focused headings do not
show an outline. Existing validation and lifecycle API behavior are unchanged.

## Verification

Backend unit and end-to-end tests cover validation, normalization,
authorization, tenant isolation, deterministic filtering, conflicts, and the
complete API workflow. Frontend tests cover response validation, form behavior,
directory states and filters, role-aware navigation, creation and editing, and
confirmed lifecycle changes.
