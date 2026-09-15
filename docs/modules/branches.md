# Branches

Owners, assigned managers and assigned cashiers can open the branch's POS cart
from branch details. Merchants have no POS entry point. This dedicated catalog
workflow does not grant cashiers product, merchant or inventory management access.
See [Branch POS](pos.md) for cart behavior and scope.
Accessible branch details also link to staff sales history or merchant own sales.
Inventory, POS and Sales actions share one responsive three-column group when all
are authorized and the viewport permits it; narrower and role-reduced views stack
the available actions without exposing inaccessible destinations.
Historical merchant selling branches are discoverable through the separate Sales
workspace entry, without granting general branch/address access. Merchants receive
no POS or full receipt-print action; cashiers retain no inventory management access.

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

- Owners read all branches and alone create branches.
- Managers/cashiers read only assigned branches; managers edit assigned branches.
- Linked merchants read identity-only branches where explicitly assigned or their
  own products are placed. Unlinked merchants receive empty lists.
- Unassigned/foreign/missing branch IDs return the same 404.
- Organization membership and object scope are enforced by the backend.

The separate [historical own-sales branch lookup](sales.md) returns identity only
for merchants with matching historical sale items. It grants no address/general
branch-detail access and does not change these existing branch routes.

The [Reports branch lookup](reports.md) also returns identity only: all tenant
branches for owners, assigned branches for managers and assigned/historical-own-sale
branches for merchants. It does not grant general branch/address/inventory access.
Cashiers cannot use Reports and retain their existing branch/POS access.

## Data and rules

`Branch` belongs to one organization and contains name, optional code, address
lines, city, province, optional postal code, and a two-letter country code.

- Name and non-null code are independently unique within an organization.
- Codes are normalized to uppercase.
- Updates reject an empty body.
- Queries include `organizationId`; a foreign branch is returned as not found.
- Organization deletion is restricted while branches exist.

Branch inventory uses the branch's `(id, organizationId)` composite key for
tenant-safe placement relations. Its backend workflows are documented in
[Branch Inventory](branch-inventory.md). Owner/manager branch details expose a
Manage inventory link to the branch-scoped inventory workspace. Merchants receive
a View own inventory link; cashiers receive no inventory action.

## Frontend

Backend-filtered branches drive the directory. Runtime schemas accept full branch
records for staff and identity-only records for merchants, stripping address fields
from merchant reads. Managers cannot create branches; assigned branch editing is
retained. Merchants see identity/code and own-inventory links, no addresses or
location filter. Empty access explains asking an owner to configure assignments
or the merchant link. Workspace branch cache clears on access refresh and organization
changes; obsolete read responses cannot repopulate it. Directory entry refreshes
accessible branches rather than relying on an indefinitely cached assignment list.

The organization workspace provides branch listing, creation, detail, and edit
flows with validation and request-state feedback.

The directory uses full-width responsive rows with visible branch identity,
optional code, complete address, and a detail link. Debounced local search matches
name/code/address; a labeled location selector filters by city and province.
Empty, filtered-empty, loading, and request-error states remain distinct. Owners
alone can add branches; managers can edit assigned branches, while cashiers and
merchants remain read-only.
Add branch appears in the Store locations panel header, consistent with other
directories. The Branches page title has no organization-name eyebrow above it.

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
