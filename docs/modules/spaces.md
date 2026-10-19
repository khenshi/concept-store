# Branch space occupancy

**Status:** Implemented October 9, 2026.

## Purpose and ownership

Optional tracking of named physical spaces (racks, shelves, and custom types) in each branch. Empty catalogs are valid. A merchant can occupy several spaces, while a space has at most one current occupant. Occupancy does not determine product placement, inventory, POS eligibility, sales, refunds, reports, or billing. Merchant–branch participation remains the access and operational relationship.

`Space` stores tenant/branch IDs, a name, organization-catalog type label, `ACTIVE`/`ARCHIVED` status, and timestamps. Names are trimmed, 1–120 characters, and unique ignoring case within a branch, including archived spaces. Types are trimmed, 1–80 characters. Only an empty space can be archived; reactivation preserves history. There are no deletion routes.

`SpaceOccupancy` stores the tenant, branch, space, merchant, occupancy interval, assignment/release actors, and release reason. It does not store separate record-creation or record-update timestamps; history is represented by the occupancy interval (`startedAt`/`endedAt`). Composite foreign keys require the space and merchant–branch association to belong to the same tenant and branch. Actor IDs are retained internally and omitted from read projections. Space/merchant/branch names in reads are current identities rather than historical snapshots.

## Dates and consistency

Intervals are `[startedAt, endedAt)`. An omitted end means current occupancy. Owners may supply past dates to backdate a current assignment or record a completed historical interval. Future dates and timezone-less timestamps are rejected; an end must be later than its start. Adjacent intervals are valid. The assignment and release forms collect dates only, use an accessible switch for the completed-history mode, normalize dates to UTC ISO boundaries for the API, and history displays the occupancy interval as local dates. Closed intervals cannot be edited or deleted.

Assignment requires an active space, active merchant profile, and active existing merchant–branch participation, including when recording past occupancy. It never creates or reactivates participation. A database partial unique index prevents multiple open occupancies; CHECK constraints protect interval and release metadata. Transactions lock the merchant, association, and space, then check every potentially overlapping interval before insert. This enforces historical exclusivity through the application write boundary without a new PostgreSQL extension.

Manual release closes the selected open occupancy at the supplied past time or action time. A second release returns 409 and does not rewrite history. Changing participation to `INACTIVE` closes all that merchant's open occupancies in that branch with `PARTICIPATION_INACTIVE`. Changing the merchant profile to `INACTIVE`, `SUSPENDED`, or `ENDED` closes all its open occupancies across the organization with the corresponding `MERCHANT_*` reason. Status change and release commit atomically. The acting owner and release timestamp are retained; repeating status changes leaves closed records untouched. Reactivation never restores assignments. Branch `INACTIVE` remains directory metadata and does not release occupancy.

Owner writes reload and lock current membership. Assignment and both automatic release paths share merchant-first locking; spaces are locked in ID order for bulk releases. Serializable transaction conflicts return 409 for refresh/retry. Archive locks the space and rechecks for an open occupant. No combined move action is offered; owners release and assign explicitly.

## API

All paths below are under `/organizations/:organizationId`. Object path IDs require UUID v4. DTO whitelisting rejects unknown fields; empty space edits are rejected. OpenAPI describes request and response schemas.

| Method      | Path                                                                   | Behavior                                             |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| GET / POST  | `/branches/:branchId/spaces`                                           | List / create spaces                                 |
| GET / PATCH | `/branches/:branchId/spaces/:spaceId`                                  | Read / edit name or type                             |
| PATCH       | `/branches/:branchId/spaces/:spaceId/status`                           | Archive / reactivate                                 |
| GET / POST  | `/branches/:branchId/spaces/:spaceId/occupancies`                      | Read occupancy / assign or record history            |
| PATCH       | `/branches/:branchId/spaces/:spaceId/occupancies/:occupancyId/release` | Release current occupancy                            |
| GET         | `/merchants/:merchantId/spaces`                                        | Current/history occupancy across accessible branches |

Space lists accept `page`, `q` (name search), `type` (case-insensitive exact label), `status`, and optional `merchantId` (current occupant for staff; own spaces for merchants). Occupancy lists accept `page`, `view=CURRENT|HISTORY`, and optional `branchId`. All lists use 15 rows with `items`, `page`, `limit`, `total`, `totalPages`, and `hasNext`. Spaces sort by name then ID; occupancy sorts by start descending then ID descending. The space list includes `currentOccupancy`; occupancy includes space identity/type/status, branch identity/code, merchant identity/code, occupancy dates, release reason, and released-by ID/name, without contact details or record-creation/update timestamps.

## Authorization

Every request requires authentication and current organization membership. Owners read/manage all tenant spaces. Managers read only assigned branches, including the branch-filtered history on merchant profiles. Linked merchant members read only their profile's occupancy in affiliated branches, including inactive participation/history. They cannot inspect other occupants or unassigned spaces. Space lists for merchants include only spaces they have occupied and project only their own open occupancy; an empty current projection does not disclose another occupant. Cashiers cannot access these routes. Missing, inaccessible, and foreign objects return the same 404. Current role, profile link, and branch grants are reloaded on each operation.

## Frontend

Branch details contain an optional Spaces section with search, catalog type/status filters, current occupancy, history, and owner-only create/edit/assign/release/archive controls. Merchant profiles contain Current spaces and Past occupancy views across authorized branches, with owner assignment/release controls. Assignment choices use active affiliations and active profiles. Historical recording requires both start and end dates. A currently occupied space still permits an owner to record a non-overlapping past interval.

Managers and merchants receive read-only lists/history, and cashiers receive no section or requests. Lists use flat responsive operational rows and existing native dialogs, with responsive loading skeletons that mirror the filters and row geometry, local loading/error/empty/success feedback, repeat-submit protection, retry controls, and obsolete-read protection. Participation and lifecycle confirmation dialogs load an advisory current occupancy count and explain automatic release before confirmation; failed count reads prevent the status command. The backend rechecks actual occupancy transactionally. Successful status/participation changes refresh the Spaces section. Empty table states use the same panel inset and vertical spacing across the Spaces list and detail history surfaces.
The branch list and occupancy history use the shared frontend
`OperationalTableFrame` for that empty-state inset and pagination footer; their
responsive row grids, filters and actions remain Spaces-owned. Their pagination
footers sit below the rows with a hairline separator and borderless arrow
controls, including for empty page results.

Spaces workspace and detail routes now use the shared gray canvas with wide
centered content. Space lists, type management, overview, actions, and occupancy
history are grouped into rounded white panels with responsive stacking; branch
selection, dirty-form guards, status controls, and role-aware data behavior are
unchanged.

## Migration and deployment

`20261009010000_add_space_occupancy` adds empty tables, enums, scoped foreign keys, indexes, and constraints. `20261011010000_remove_space_occupancy_recording_timestamps` removes the occupancy-only record-creation/update columns; it preserves occupancy interval dates and release metadata. These migrations create no spaces and backfill no occupancy from inventory or sales. Apply them before deploying the matching API/frontend. Earlier pending branch/merchant-affiliation migrations retain their documented rollout requirements; these migrations do not replace them. Production migration/deployment has not been performed.

See [validation](../validation/spaces-2026-10-09.md) for local checks and baseline limitations.

## Dedicated workspace (October 10, 2026)

Spaces appears after Inventory in Branch operations for owners, managers, and
merchants. `/app/organizations/[organizationId]/spaces` offers authorized branch
selection and resumes an accessible remembered workspace branch.
`/app/organizations/[organizationId]/branches/[branchId]/spaces` opens that
branch directly. Direct URL selection takes precedence over remembered selection;
inaccessible choices show guidance rather than loading space records or selecting
an arbitrary replacement. Authorized inactive branches remain selectable.
Cashiers receive no navigation entry or data requests and see a direct-route denial.

The page reuses branch `SpaceManagement` and its forms; space details now have a
dedicated route, while branch-detail and merchant-profile sections remain available.
Switching branches resets list and
dialog state, respects existing POS/refund navigation guards, confirms discarding
dirty space forms, and is disabled while space mutations are pending. Obsolete
branch reads are ignored. Managers remain read-only and merchants retain only their
own occupancy projections, including historical spaces; a missing own current
projection does not imply that the space is vacant.

The branch list defaults to Active spaces and presents Space, Type, Status,
Occupancy, and Actions columns. Each item row uses the small body-text scale.
Status and occupancy values use semibold colored text without pill backgrounds or
borders; active/occupied/vacant values use the success treatment and archived
values use the danger treatment. The Space column remains flexible, while a
fixed Actions column keeps the header and row values aligned when role-specific
actions differ.
The branch list uses the shared Inventory operational surface: a bordered card
header, soft-gray filter toolbar, muted field labels, white search input,
rounded select controls, and matching header/row spacing. Existing filters,
status semantics, pagination, and actions are unchanged.
Owner row actions are limited to Assign, Archive, and View; Archive is disabled
for occupied spaces and uses the danger treatment.
View opens `/app/organizations/[organizationId]/branches/[branchId]/spaces/[spaceId]`,
which provides the space overview, current occupancy, paginated occupancy history,
and owner-only actions for assignment, editing, release, and status changes. The
detail view keeps managers and merchants read-only and provides a branch switcher
and return link without duplicating the list workflow. Its occupancy history is a
full-width operational table below the overview/actions area with Merchant, From
date, Until date, and Released by columns. Empty date filters mean all dates;
merchant search and overlapping date-range filters are applied by the existing
paginated occupancy endpoint so totals remain correct. Released by exposes only
the actor ID/name, never contact details.

Owners/managers can filter branch lists by Occupancy: All, Occupied, or Vacant,
including in the existing branch-detail section. The existing GET branch spaces
endpoint accepts optional `occupancy=OCCUPIED|VACANT`. Occupied means an open
occupancy (`endedAt = null`); Vacant means no open occupancy, regardless of closed
history. The predicate combines with existing filters before count and pagination.
Archived vacant spaces remain unassignable. Omission preserves the existing list.
Invalid values receive 400; authenticated merchants receive 403 for either value
after branch access checks, without evaluating occupancy. The merchant UI omits
this filter. There are no new entities, migrations, or dependencies.

See [workspace validation](../validation/spaces-workspace-2026-10-10.md) for checks
and the outstanding browser and deployment boundaries.

## Organization space types (October 10, 2026)

The dedicated workspace has Spaces and Types tabs for owners/managers. Types is
organization-wide and does not require branch selection. Owners create types;
managers read the shared catalog. Merchants keep their own Spaces view without
the management tab, and cashiers remain excluded. Tabs support arrow/Home/End
keyboard navigation, selected-state semantics, dirty-draft confirmation, and
pending-write protection.

`SpaceType` stores an ID, organization ID, name, and creation timestamp. Names are
trimmed, 1–80 characters, and unique case-insensitively per organization. There
are no rename, deletion, or archive commands. GET `/organizations/:organizationId/space-types`
returns an array of `{ id, organizationId, name }` without counts. Owners and
managers receive the organization catalog. Merchants receive only types used by
their own accessible current/past spaces. POST on the same path creates a type
and is owner-only; duplicate names receive 409, invalid/unknown body fields 400,
and cashier access 403. Current membership is reloaded for both operations.

Space creation/edit uses a focused form dialog with the name field receiving
initial focus, persistent field guidance, live field-level validation, and a
compact responsive layout. Blank space names show a small error beside the field
label after the field is touched. The space name occupies the first row; the
type dropdown and Create a new type action share the second row. Choosing Create
a new type replaces the dropdown with a new-type input, Save type, and Discard
controls aligned with that input; a short organization-wide description sits
below the input. Blank new-type names show the same compact inline validation.
In the Types tab, new-type validation appears below the input and Save type uses
the primary colored action. There is no expanded section below it. The primary
action stays last in the keyboard order and becomes the first full-width action
on phones. Closing a
dirty form asks before discarding the space draft. Creating a type retains the
space draft and selects/reloads the created type;
failed creation preserves input for retry. A successfully created type remains
available if the space form is cancelled. Branch-space filters use catalog
choices, including privacy-scoped choices for merchants. Type-list failures show
an explicit retry action and do not silently submit a missing selection.

Migration `20261010010000_add_space_types` runs transactionally while locking
Space writes, backfills all existing labels (including archived spaces), and
chooses deterministic canonical spelling for case variants within each tenant.
Space identities, timestamps, statuses, and occupancy records are retained. A
composite foreign key ties Space's `(organizationId, type)` to the catalog's
`(organizationId, name)`. A registration trigger atomically registers and
canonicalizes existing string-based writes; failed space writes roll back their
implicit new types. This preserves the existing API response/request shape and
supports legacy clients during deployment. Explicit catalog creation still
rejects duplicates rather than silently returning another record.

Apply the new migration before the matching API/frontend. It has only been
applied to disposable test databases in this session. For application rollback,
keep the additive schema and legacy-compatible trigger. If a schema rollback is
separately authorized, remove the Space catalog foreign key, trigger, function,
and catalog table in that order; retain space strings/occupancy. Canonical
capitalization remains unless restored from a prior backup. See
[type validation](../validation/space-types-2026-10-10.md).
