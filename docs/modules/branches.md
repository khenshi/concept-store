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
The inventory action also shows current in-stock, low-stock and out-of-stock
placement counts. Low/out-of-stock count links open the branch Inventory directory
with the corresponding filter already selected, where the existing row-level
Receive stock action remains available. Merchant labels and counts explicitly
cover only their own visible placements; cashiers receive neither the inventory
action nor a summary request.

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
- Linked merchants read identity-only branches associated with their linked merchant profile, including inactive participation. Unlinked merchants receive empty lists.
- Unassigned/foreign/missing branch IDs return the same 404.
- Organization membership and object scope are enforced by the backend.

The separate [historical own-sales branch lookup](sales.md) returns identity only
for merchants with matching historical sale items. It grants no address/general
branch-detail access and does not change these existing branch routes.

The [Reports branch lookup](reports.md) also returns identity only: all tenant
branches for owners, assigned branches for managers and profile-affiliated/historical-own-sale
branches for merchants. It does not grant general branch/address/inventory access.
Cashiers cannot use Reports and retain their existing branch/POS access.

## Data and rules

`Branch` belongs to one organization and contains name, optional code, address
lines, city, province, optional postal code, and a two-letter country code.

Branches also have an explicit `status` of `ACTIVE` or `INACTIVE`. New branches
default to `ACTIVE`; changing status is reversible metadata for the directory
and does not remove branch access or change POS, inventory, or sales behavior.

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
Summary failures remain local to the inventory action and can be retried without
hiding otherwise available branch information. Obsolete summary responses are
discarded after branch, role, user or access changes.

## Frontend

Backend-filtered branches drive the directory. Runtime schemas accept full branch
records for staff and identity-only records for merchants, stripping address fields
from merchant reads. Managers cannot create branches; assigned branch editing is
retained. Merchants see identity/code and own-inventory links, no addresses or
location filter. Empty access explains asking an owner to configure staff assignments or merchant affiliations
or the merchant link. Workspace branch cache clears on access refresh and organization
changes; obsolete read responses cannot repopulate it. Directory entry refreshes
accessible branches rather than relying on an indefinitely cached assignment list.

The organization workspace provides branch listing, creation, detail, and edit
flows with validation and request-state feedback.

Staff also use the paginated directory projection:

```text
GET   /organizations/:organizationId/branches/directory?q=&status=&page=
PATCH /organizations/:organizationId/branches/:branchId/status
```

The directory is limited to ten rows per page, searches branch name, code, city,
province, and address, and returns the filtered total, page metadata, an
unfiltered accessible summary of total/active/inactive counts, and each row's
active merchant count. The count includes all active merchant–branch associations,
including merchants without placements. Owners and
assigned managers may change branch status; cashiers may read it but cannot
change it. The original branch list and merchant identity-only projection
remain available to branch selectors and merchant workflows.

The staff directory keeps the page header on a warm gray canvas, then presents a
compact summary card and a separate flat white Store locations card. Search/status
controls, loading states and table rows remain inside the Store locations card.
Its rows use the Inventory directory's shared column-header and data-row geometry:
quiet hairline dividers, the same wide-screen column rhythm, stacked narrow-screen
content, and compact quiet View actions. Rows show branch name/code, city and
short address, merchant count, semantic Active/Inactive pill statuses, and a View
action aligned beneath the Actions column label. The footer reports the current range such as
`Showing 1–10 of 24` with previous/next pagination. Search and status changes
reset to page one. Empty, filtered-empty, loading, and request-error states
remain distinct. Owners alone can add branches; managers can edit assigned
branches and change their status, while cashiers remain read-only.
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

Rendered branch inventory-health card layout, filtered-link behavior, keyboard/
focus behavior, non-color communication and 200% zoom QA were explicitly waived
September 16, 2026. Automated tests cover the contracts and state transitions but
do not certify those rendered behaviors.

## Merchant branch participation

See [Merchant–branch relationships](merchant-branches.md) for profile-inherited access,
active participation requirements, inactive read/history preservation, migration,
and association management. This contract supersedes individual merchant grants
and placement-derived merchant branch visibility described in earlier milestones.

## Optional physical spaces

See [Branch space occupancy](spaces.md) for named space management, dated
assignments, authorization, and automatic release. Branch details show owner
controls and scoped manager/merchant reads. A branch can have no configured spaces;
its lifecycle status remains metadata and does not release space occupancy.
