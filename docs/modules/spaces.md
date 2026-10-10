# Branch space occupancy

**Status:** Implemented October 9, 2026.

## Purpose and ownership

Optional tracking of named physical spaces (racks, shelves, and custom types) in each branch. Empty catalogs are valid. A merchant can occupy several spaces, while a space has at most one current occupant. Occupancy does not determine product placement, inventory, POS eligibility, sales, refunds, reports, or billing. Merchant–branch participation remains the access and operational relationship.

`Space` stores tenant/branch IDs, a name, organization-catalog type label, `ACTIVE`/`ARCHIVED` status, and timestamps. Names are trimmed, 1–120 characters, and unique ignoring case within a branch, including archived spaces. Types are trimmed, 1–80 characters. Only an empty space can be archived; reactivation preserves history. There are no deletion routes.

`SpaceOccupancy` stores the tenant, branch, space, merchant, start/end timestamps, assignment/release actors, release reason, and record timestamps. Composite foreign keys require the space and merchant–branch association to belong to the same tenant and branch. Actor IDs are retained internally and omitted from read projections. Space/merchant/branch names in reads are current identities rather than historical snapshots.

## Dates and consistency

Intervals are `[startedAt, endedAt)`. An omitted end means current occupancy. Owners may supply past timestamps to backdate a current assignment or record a completed historical interval. Future dates and timezone-less timestamps are rejected; an end must be later than its start. Adjacent intervals are valid. Dates travel as UTC ISO timestamps; the UI accepts and displays local time. Closed intervals cannot be edited or deleted.

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

Space lists accept `page`, `q` (name search), `type` (case-insensitive exact label), `status`, and optional `merchantId` (current occupant for staff; own spaces for merchants). Occupancy lists accept `page`, `view=CURRENT|HISTORY`, and optional `branchId`. All lists use ten rows with `items`, `page`, `limit`, `total`, `totalPages`, and `hasNext`. Spaces sort by name then ID; occupancy sorts by start descending then ID descending. The space list includes `currentOccupancy`; occupancy includes space identity/type/status, branch identity/code, merchant identity/code, dates, and release reason, without contacts or actors.

## Authorization

Every request requires authentication and current organization membership. Owners read/manage all tenant spaces. Managers read only assigned branches, including the branch-filtered history on merchant profiles. Linked merchant members read only their profile's occupancy in affiliated branches, including inactive participation/history. They cannot inspect other occupants or unassigned spaces. Space lists for merchants include only spaces they have occupied and project only their own open occupancy; an empty current projection does not disclose another occupant. Cashiers cannot access these routes. Missing, inaccessible, and foreign objects return the same 404. Current role, profile link, and branch grants are reloaded on each operation.

## Frontend

Branch details contain an optional Spaces section with search, catalog type/status filters, current occupancy, history, and owner-only create/edit/assign/release/archive controls. Merchant profiles contain Current spaces and Past occupancy views across authorized branches, with owner assignment/release controls. Assignment choices use active affiliations and active profiles. Historical recording requires both start and end dates. A currently occupied space still permits an owner to record a non-overlapping past interval.

Managers and merchants receive read-only lists/history, and cashiers receive no section or requests. Lists use flat responsive operational rows and existing native dialogs, with local loading/error/empty/success feedback, repeat-submit protection, retry controls, and obsolete-read protection. Participation and lifecycle confirmation dialogs load an advisory current occupancy count and explain automatic release before confirmation; failed count reads prevent the status command. The backend rechecks actual occupancy transactionally. Successful status/participation changes refresh the Spaces section.

## Migration and deployment

`20261009010000_add_space_occupancy` adds empty tables, enums, scoped foreign keys, indexes, and constraints. It creates no spaces and backfills no occupancy from inventory or sales. Apply it before deploying the matching API/frontend. Earlier pending branch/merchant-affiliation migrations retain their documented rollout requirements; this migration does not replace them. Production migration/deployment has not been performed.

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

The page reuses branch `SpaceManagement`, forms, and history dialogs; branch-detail
and merchant-profile sections remain available. Switching branches resets list and
dialog state, respects existing POS/refund navigation guards, confirms discarding
dirty space forms, and is disabled while space mutations are pending. Obsolete
branch reads are ignored. Managers remain read-only and merchants retain only their
own occupancy projections, including historical spaces; a missing own current
projection does not imply that the space is vacant.

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

Space creation/edit uses a catalog dropdown. Add type expands an inline creator,
retains the space draft, and selects/reloads the created type. Failed creation
preserves input for retry. A successfully created type remains available if the
space form is cancelled. Branch-space filters use catalog choices, including
privacy-scoped choices for merchants. Type-list failures have refresh/retry and
do not silently submit a missing selection.

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
