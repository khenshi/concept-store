# Plan 20: Space-type maintenance and occupancy actor privacy

Date: October 24, 2026

Status: Draft for review; planning only. No schema, API, UI, privacy projection,
type label or database changes performed during this task.

Priority: Both privacy correction and Owner type maintenance required before
real pilot, confirmed October 24.

## 1. Goal and confirmed rules

Owners can rename/archive/reactivate organization space types without breaking
existing spaces. Merchant occupancy responses omit release-actor identity at the
backend, not merely in the UI. Own the Spaces additions in the
[deployment checklist](../../deployment-readiness-checklist.md) and [queue](README.md).

Confirmed October 24:

- Existing spaces retain archived types; new spaces/type changes cannot choose
  archived types. Owners may reactivate them.
- Renamed labels display everywhere, including occupancy history. No original
  type-label snapshot is required. Other saved financial/history snapshots remain
  unchanged; this is specifically the current space type display policy.
- Owner rename/archive/reactivation and the Merchant privacy fix are pre-pilot.

Previously confirmed: Released by ID/name is staff-only; Owners and authorized
assigned Managers retain it, Cashiers remain denied Spaces. Preserve internal
actor attribution, Merchant own occupancy dates/business details and existing
assignment/release permissions. No Manager type-write permission is introduced.

Exclude type/space/occupancy hard deletion, type merging, automatic occupancy
release, a generic catalog abstraction, lease billing or a global audit system.
Reuse existing space-type model, dialog/table styles and tenant boundaries.

## 2. Current architecture and risks

Reviewed Prisma SpaceType/Space/SpaceOccupancy models, the space-type migration,
SpacesService/controller, frontend schema/detail/form paths and queue requirements.

- SpaceType already has stable UUID and organization/name uniqueness. A raw SQL
  unique index additionally enforces organization/lower(name); don't overlook it
  because Prisma lists only the case-sensitive unique key.
- Space links to type via `(organizationId,type)` → `(organizationId,name)` with
  ON UPDATE CASCADE and restrictive deletion. There is no archived state today.
- `register_space_type` trigger canonicalizes input and auto-inserts unknown names
  on Space insert/type update. It can recreate an old renamed name or undermine
  explicit catalog management if left unchanged. Service create/update writes
  incoming type strings without an explicit catalog availability gate.
- Shared `occupancySelect` fetches release actor and `projectOccupancy` always
  returns releasedBy. Used in history and nested current occupancy; frontend
  schema requires that field. Hiding one column would leave API exposure intact.
- Existing space mutations are Owner-only; read scope includes Managers/Merchants.
  Preserve those role rules even when 16 discusses controlled branch closure.
- No application tests, migration/database, race or browser checks ran for this
  planning draft. This is a source finding, not a verified deployed-data audit.

## 3. Privacy projection correction

Create explicit staff and Merchant occupancy selections/projections/types. Merchant
queries should not select release-user identity unnecessarily and must omit
releasedBy, releasedById and nested actor identity from serialized responses—not
return the identity as null while leaving another path exposed. Staff keeps the
current nullable actor display shape; internal stored FK remains unchanged.

Inventory every consumer: space list/currentOccupancy, space detail, occupancy
history, merchant occupancy/history and any reused association/summary endpoint.
Use the fresh trusted role/merchant context, not client role or UI route, to choose
projection. Preserve own-merchant predicates and tenant/branch ties throughout.
No name-based redaction after fetching an unrestricted shared object.

Update OpenAPI staff/Merchant response variants, frontend role-aware runtime
schemas/types, fixtures and rendering together. Merchant schemas must detect
unexpected actor fields at relevant objects, not silently strip a regression and
pretend privacy passed. Account for current schema refinements that assume actor
presence on released rows; use release dates/reason for Merchant-safe validation.

Hide the staff-only column and accessible label for Merchants. Retain permitted
release reason/dates without inferring or fetching actor name separately. Drop
cached staff results after role/user/tenant/access changes and reject late staff
responses, including nested current occupancy. No UI-only security boundary.

## 4. Minimal type management model/API

Add archived state (`archivedAt` or one simple status, choose one) and updatedAt/
optimistic concurrency token where required. No duplicate active/archive catalog.
Existing types migrate active without renaming, orphaning or deleting rows.
Retain stable IDs, trim/1–80-character name checks and case-insensitive tenant
uniqueness across active AND archived rows; archive does not free a name for reuse.

Proposed Owner-only versioned update by stable ID:

```text
PATCH /organizations/:organizationId/space-types/:typeId
{ name?, archived?, expectedVersion }
```

Reuse existing create/list routes with explicit management versus selectable
filter/projection semantics. Create never silently reactivates an archived name;
it conflicts with guidance to use the existing type. No empty PATCH; invalid or
foreign IDs retain existing safe not-found behavior after authorization. Same-state
or unchanged name is a no-op, not a new state transition. Case-only rename of the
same type is allowed if validated; conflict with another normalized name returns
a descriptive 409. Stale expected version conflicts rather than overwrites.

Manager/Merchant type reads retain current authorized scope; no new broad type
discovery. Owner management can show archived rows; active-only choices plus
current archived selection are a distinct form use case. Do not filter archived
types out of historical space list/filter results or hide existing spaces.

## 5. Rename and trigger strategy

Prefer retaining the existing name-based FK with cascade for the confirmed current-
label display policy, provided disposable tests prove safe rename/canonicalization
and lock behavior. Use stable type ID in management writes; do not introduce a
new spaceTypeId relationship solely for elegance. If evidence shows this cannot
be made safe, stop for a bounded preservation-safe migration proposal before coding.

Replace auto-registration with explicit validated type resolution. New/changed
type values must resolve an existing active tenant type; unknown names reject and
cannot recreate renamed catalogs. Update/remove the old trigger deliberately in a
forward migration, not by rewriting prior SQL. Preserve canonical name spelling
and same-tenant FK; no legacy compatibility path that auto-creates unknown types.

Existing space edits that do not change type may retain its archived type. A
payload echoing the same archived identity must be treated as unchanged, not new
selection. Switching to another type requires active target. Stale renamed input
must conflict/refresh, never recreate old label or silently assign another type.
Inspect partial/full form DTO behavior before finalizing validation.

ON UPDATE CASCADE changes current Space.type; occupancy reads already join current
space identity and therefore show the renamed label as confirmed. Do not alter
occupancy dates/merchant/actor IDs or rewrite financial snapshots. Test cascade
against trigger behavior explicitly; a rename must not register a second type.

Archive does not archive spaces, close occupancy, unassign merchants or change
stock/sales. Existing active spaces may continue their existing permitted workflows
under their retained type unless 16/other current rules block them. Reactivating
the type only restores new selection eligibility, not other lifecycle/access state.

## 6. Concurrency and tenant enforcement

Validate current verified identity, membership/Owner role and active organization
inside mutation transaction. Scope every lookup/update by organizationId and ID;
cross-tenant name conflicts/foreign references must not disclose other catalogs.
07 inactive tenants permit authorized history, not type writes. Organization-wide
type rename/archive is not a new branch operation; 16 still gates space writes.

Coordinate rename/archive/reactivate and space create/type edit through a consistent
type/branch/space lock protocol compatible with 16. Preserve existing merchant/space
occupancy lock order; inspect full cascade impact before choosing lock order.
If archive wins, new selection rejects; if valid selection commits first, archive
keeps that existing use. Versioning alone doesn't prevent a selection race.

Handle concurrent case-insensitive creates/renames via DB constraint, not only
preflight. Rename and archive in one request apply atomically if supported; no
partial label/status update. Bounded serialization/deadlock retries cannot produce
duplicate types or erase user conflicts. No lock across user interaction/network.

## 7. UI and integration

Reuse current Types tab with Owner Edit/Archive/Reactivate actions, status labels
and existing FormDialog/notice patterns. No separate administration app or table
framework. Invalid/unchanged saves disabled; pending lock/dismissal and focus return
follow shared conventions. Explain global label update, retained existing uses and
new-selection restriction; no destructive-delete language for archive.

Space forms use active choices and display their current archived type explicitly
without offering it for another space/type switch. Handle stale rename/archive
responses with typed feedback and safe requery, not silently clearing saved value.
Keep Merchant types/space identity access scoped and staff actor labels absent.
No general visual redesign; 11 verifies actual keyboard/mobile/dropdown behavior.

Dependencies: 03/07 auth/activation, 04/06 migration/release, 11 workflow/privacy
rendering, 12 security/query/race review, 13 identity-retention policy, 14 pre-pilot
gate and 16 branch operation matrix. 15's docs cleanup must not describe the actor
leak away. No dependency on optional CSV or any payout/lease module.

## 8. Migration, phases and verification

1. Finalize projection inventory, type status/version contract, trigger replacement
   and consistent locks. Capture current association/occupancy authorization tests.
2. Implement privacy projection fix and role-aware schemas first; it can be reviewed
   independently of type schema work without pretending the whole plan is complete.
3. Add forward additive archive/version migration and explicit catalog resolution;
   preserve IDs/relations/unique indexes and replace auto-registration safely.
4. Deliver Owner type updates/form choices and stale-state UX, preserving existing
   space permissions/history/current-label semantics.
5. Unit/HTTP tests: Owner-only writes, Manager staff projection, Merchant own-only
   data with actor absent recursively, Cashier denial, foreign IDs, inactive tenant,
   archived unchanged selection versus new selection, no-op/case/conflict/version.
6. Verified disposable PostgreSQL: migrate full chain/current fixtures, rename
   cascade/trigger, occupied/archived spaces, archived-name collisions, concurrent
   rename/archive/create/type change and rollback on FK/event errors where relevant.
   Prove no orphan spaces, duplicate names or history/occupancy mutation.
7. Inspect raw Merchant JSON—not just parsed client output—across every current/
   nested/history endpoint. Test actor absence after staff-to-Merchant demotion,
   cached/late responses, account anonymization and role refresh. Keep internal
   audit FK and staff visibility intact.
8. Run format/lint, app/test-source checks, Prisma validate/generate/migration
   rehearsal, relevant unit/HTTP/integration suites and builds. Deep security/
   migration/concurrency review before real use; 11 supplies real browser proof.
9. Update Spaces/frontend module docs and OpenAPI after delivery. 14 consumes
   evidence; no privacy or type-maintenance checkbox closes from this draft alone.

Deploy matching API/client migration through 04/06. Older clients assuming mandatory
releasedBy must be upgraded; never restore a leaky response for client compatibility.
Rollback only compatible privacy-safe code. Do not resurrect auto-registration or
drop archive constraints while callers can choose forbidden types. Preserve data,
prefer forward repair and restrict affected actions under approved operations
procedure if compatibility cannot be maintained. No reset authorized here.

## 9. Completion and remaining gates

Complete when Merchant payloads/UI never expose release actor identity, staff
visibility/internal attribution remains correct, and Owner type updates preserve
references with atomic active/archive selection rules and current-label history.
Both are required before pilot. No new business clarification remains for this
draft; exact FK/trigger/version/lock mechanics and real migration/privacy/browser
evidence remain implementation gates.

After drafting this final numbered plan, perform the separately requested full
batch coverage/dependency/open-decision review before calling planning complete
or promoting any implementation. No pending plan authorizes itself.
