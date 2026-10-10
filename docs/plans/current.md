# Current plan

## Dedicated Spaces workspace

**Status:** Approved by the user October 10, 2026; implemented locally.
Owner desktop/mobile creation, type filtering, and tab workflows were verified
in Safari against an isolated disposable database. Broader manager/merchant and
assignment/release browser checks remain pending; their automated coverage passes.
Keep this plan current for those acceptance checks. Production migration and
deployment remain outside the approved scope.

### Problem and outcome

Spaces currently lives inside branch details and merchant profiles. Owners and
managers must navigate through those records to perform routine occupancy work.
Add a Spaces destination alongside Inventory and Reports so users can open an
authorized branch's spaces directly, identify vacant spaces, and use the existing
assignment, release, archive, and history workflows.

### User-approved scope adjustment (October 11, 2026)

Add a standalone space detail route behind each branch-row View action. Reuse the
existing space, occupancy, assignment, release, and status contracts and forms;
do not add entities, migrations, dependencies, or a second management model.
The detail history is a full-width section below the overview/actions area, uses
the established operational table pattern, and adds server-backed merchant/date
filters plus a privacy-limited released-by display name.

The user also approved removing `SpaceOccupancy` record-creation and
record-update timestamps from the database and API. Occupancy history keeps
only its interval dates (`startedAt`/`endedAt`) and released-by identity; the
space entity's own creation/update timestamps remain unchanged.
Assignment and release dialogs use date-only controls and a compact two-column
layout for related selections and historical date ranges.

### Existing dependencies and boundaries

- Reuse the implemented [spaces module](../modules/spaces.md), its API client,
  schemas, `SpaceManagement`, forms, dialogs, and authorization rules.
- Follow the organization shell and shared selected-branch behavior used by
  Inventory and Reports. Use the existing role-scoped branch-list API rather
  than inventory/report-specific endpoints.
- Preserve branch-detail and merchant-profile Spaces sections and their lifecycle
  refresh behavior. New routes provide another entry point to the same records.
- Preserve all unrelated worktree changes. The existing space-occupancy work is
  present locally, including untracked files; do not recreate or overwrite it.
- Existing branch/merchant-affiliation/space migrations and production deployment
  remain pending. See [local validation](../validation/spaces-2026-10-09.md).

### Routes and navigation

| Route                                                                      | Responsibility                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/app/organizations/[organizationId]/spaces`                               | Load access and branch choices; resume an accessible remembered branch or show branch selection.           |
| `/app/organizations/[organizationId]/branches/[branchId]/spaces`           | Validate branch access, show branch identity and selector, and render the existing branch Spaces workflow. |
| `/app/organizations/[organizationId]/branches/[branchId]/spaces/[spaceId]` | Show the selected space overview, occupancy history, and authorized actions.                               |

- Add **Spaces** immediately after Inventory in Branch operations, preserving
  the relative order of existing destinations. Support expanded, collapsed, and
  mobile navigation using existing shell behavior and an existing suitable icon.
- Mark Spaces active on its entry and branch routes. Do not also mark Branches
  active; similarly named routes must not match accidentally.
- Keep route modules thin. Feature-owned entry, branch-page, and selector
  components belong under `frontend/src/features/spaces/`.
- Use the URL branch on direct visits. Verify access before remembering it. The
  URL takes precedence over a previously selected branch.
- Resume a remembered branch only after it appears in the current authorized
  branch list. If unavailable, show an explanatory message and available choices;
  do not redirect to an arbitrary branch or request its spaces.
- Switching branch updates the shared workspace selection through the existing
  navigation mechanism. Preserve POS/refund pending-operation navigation guards.
- Include accessible inactive branches where existing branch access permits
  them: branch status alone does not release occupancy or prohibit management.

### Page behavior

- Use `OperationalPage`, `PageHeader`, existing controls, and DESIGN.md's flat
  operational layout. Title the destination **Spaces** and show branch context.
- Reuse the responsive space rows: name, type, active/archived status, current
  merchant where authorized, and existing actions/history. Avoid a second set of
  management forms or a second data model.
- Retain name search, exact type filtering, status filtering, and ten-row
  pagination. The branch list defaults its status filter to Active and shows
  status in its own column.
- Keep owner branch-row actions limited to Assign, Archive, and View. Archive is
  disabled for occupied spaces; the detail route contains the remaining
  owner-only edit, release, and reactivation actions.
- Add an owner/manager **Occupancy** filter: All, Occupied, Vacant. Keep lifecycle
  status separate: an archived vacant space is not assignable. Existing row copy
  and disabled/absent actions must continue to make that distinction clear.
- Owners retain create/edit/assign/release/archive/reactivate and historical
  recording controls. Managers receive read-only rows and history.
- Merchants see only their own current/past occupancy under existing rules, with
  guidance explaining that scope. Do not present vacancy filtering, other
  merchants, or language implying an organization-wide catalog. A null own
  occupancy projection must not be labeled as proof of vacancy.
- Keep merchant-profile views and existing occupancy workflows. The new detail
  route replaces the branch-row history dialog for direct space review while
  retaining the shared forms and authorization boundaries.
- Handle access loading, branch loading, no accessible branches, no configured
  spaces, no own assignments, no filter matches, request errors, and retry.
  Role/access changes must discard stale rows and owner-only controls.
- Branch changes reset pagination, filters, feedback, and dialogs. Require
  confirmation before discarding a dirty space form; cancellation preserves the
  current URL, branch selection, and draft. Disable switching while a mutation
  is pending. Ignore obsolete reads from previous branches or organizations.
- Preserve dialog focus restoration, keyboard operation, visible focus,
  submission locks, and conflict/error feedback across all entry points.

### Minimal API extension

The current paginated list has no vacancy filter. Filtering only the returned
ten rows would produce incorrect totals and omit matching spaces.

- Extend the existing GET branch spaces query with optional
  `occupancy=OCCUPIED|VACANT`; omission means All. Reject unsupported values and
  continue rejecting unknown query fields.
- For owners/managers, Occupied means an open occupancy (`endedAt = null`);
  Vacant means no open occupancy. Completed history does not make a space
  occupied. Combine this predicate with existing tenant/branch, search, type,
  status, and merchant filters before both count and pagination.
- Reject the occupancy query for merchants with 403, for either value, without
  evaluating or disclosing occupancy. Their existing unfiltered own-space list
  and privacy-preserving projections remain unchanged. Cashier access remains
  denied. Authentication and object access checks still run first.
- Update the DTO, service, OpenAPI query documentation, client filter type, and
  API tests. Keep existing fields and default query behavior unchanged.
- Extend the existing occupancy query with optional `q`, `dateFrom`, and
  exclusive `dateTo` filters. Search merchant name/code case-insensitively and
  return occupancy periods that overlap the selected range; omission means all
  merchants and all dates. Include only released actor ID/name in the response,
  never email or phone.
- No new endpoint or database index is planned. The approved timestamp cleanup
  adds one destructive migration that drops only `SpaceOccupancy.createdAt` and
  `SpaceOccupancy.updatedAt`; interval dates and release metadata remain.

### Authorization and integrity

| Role     | Spaces workspace access                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| OWNER    | All authorized organization branches; existing space management.                                              |
| MANAGER  | Assigned branches only; read-only spaces and history.                                                         |
| MERCHANT | Affiliated branches and own occupancy/history only, including inactive participation where already permitted. |
| CASHIER  | No navigation entry, no spaces requests, and a clear direct-route denial.                                     |

Backend membership, branch, and object checks remain authoritative. Foreign or
inaccessible branch/space IDs retain the same 404 as missing objects. Do not
change overlap prevention, assignment prerequisites, automatic releases,
historical immutability, archive constraints, or transaction boundaries.

### Explicit exclusions

No floor plans, rack/shelf diagrams, drag-and-drop allocation, bulk actions,
combined moves, reservations, future assignments, occupancy analytics, summary
counts, exports, rental pricing, agreements, billing, inventory placement,
cross-branch aggregate catalog, new roles, permission granularity, infrastructure,
dependencies, deployment, or production database operations. No unrelated shell
refactor or redesign of existing Inventory/Reports pages.

### Implementation sequence after approval

1. Record current navigation/branch-selection and Spaces test baselines. Confirm
   branch-list projections cover each existing spaces role and inactive access.
2. Add the narrowly scoped occupancy query and backend/client regression tests.
3. Add thin routes, feature-owned access/selection wrappers, and navigation;
   reuse `SpaceManagement` and existing branch-selection contracts. Extract only
   a small space-owned presentation option if full-page headings would duplicate.
4. Add occupancy filtering to the shared branch Spaces component so branch
   details and the new page stay consistent. Preserve merchant-profile behavior.
5. Complete interaction, authorization, responsive, and documentation checks.

### Validation and acceptance

- Backend tests: occupied/vacant/all results and totals across multiple pages;
  spaces with only closed history; archived spaces; combined filters; invalid
  input; denied merchant/cashier queries; assigned manager scope and foreign
  tenant/branch IDs. Use a disposable database for actual relation-filter proof.
- Frontend tests: role navigation visibility; precise active-route matching;
  remembered branch reuse across Inventory/Reports/Spaces; URL precedence;
  unavailable branch handling; no cashier data requests; own-only merchant
  presentation; filter serialization and pagination reset; stale-read protection;
  retry; dirty-dialog cancellation; pending mutation branch-switch prevention.
- Run existing space-management, navigation, shell, shared branch-selection,
  branch, and merchant-profile tests to detect regressions. Run frontend lint,
  typecheck, tests, and build; backend lint, build, and applicable tests. Check
  formatting of changed files. Record pre-existing failures separately.
- Browser-check desktop and narrow mobile: navigation, branch switching,
  search/filter/pagination, representative owner assignment/release/history,
  manager read-only and merchant privacy states, keyboard/dialog focus, and
  loading/error/empty states. Confirm existing branch/profile entry points work.
- Done means the new navigation and both routes work within current access
  boundaries, server filtering produces correct complete-list totals, existing
  workflows still work, and relevant checks pass with documented baseline gaps.

### Documentation and completion

After implementation, update `docs/modules/spaces.md` and
`docs/modules/frontend-experience.md` with routes, navigation, branch selection,
filter semantics, and access behavior. Add a scoped validation record with local
evidence and unresolved rollout boundaries. Archive this plan only when completed
or explicitly superseded; restore `current.md` to an accurate remaining-work
status. Do not mark production migration/deployment complete based on local QA.

## Completed follow-up

Organization-wide space types and the Spaces/Types tabs were implemented and
validated locally on October 10, 2026. The [completed plan](archive/organization-space-types-2026-10-10.md)
and [validation record](../validation/space-types-2026-10-10.md) preserve the scope,
compatibility/rollback design, and outstanding live rollout boundaries.
