# Organizations

**Status:** Implemented

## Responsibilities

- List organizations available to the authenticated user.
- Load one organization through membership-derived access.
- Switch between accessible organization workspaces.
- Rename an organization as its Owner.
- Apply active/inactive tenant lifecycle state.
- Provision the immutable system Cash payment account for each organization and
  expose Owner-only Payment Account configuration in the workspace.

## API

```text
GET  /organizations
GET  /organizations/:organizationId
PATCH /organizations/:organizationId
```

## Rules

- Organizations are provisioned and activated only through the protected
  server-side operator command. Ordinary users cannot create tenants through
  the HTTP API.
- Provisioning creates an inactive organization and an Owner membership only
  after the selected Owner has a verified email. Operation IDs make lost
  operator responses safely replayable; lifecycle events record the sanitized
  operator identity, reason, target and status transition.
- An inactive organization remains visible to authorized verified members for
  read-only history, while organization-scoped writes are rejected server-side.
  Reactivation does not recreate memberships or assignments.
- Authoritative mutation services recheck the organization status inside their
  write transaction and lock the organization row before changing tenant data.
  Lifecycle deactivation therefore serializes with in-flight writes instead of
  relying only on the HTTP guard. Idempotent retries may still return an
  already committed command result without creating a new write.
- Owners may rename their organization through the authenticated, tenant-scoped
  PATCH route; renaming does not change its identity or history.
- Organization access is derived from `OrganizationMembership`; possession of
  an organization UUID does not grant access.
- An unavailable or foreign organization is returned as not found.
- Organization IDs use UUID v4 validation.

## Data

`Organization` is the tenant root. Tenant-owned modules reference its ID and
must enforce the global isolation rules in `AGENTS.md`.

## Frontend

Authenticated verified users can view their available organizations, switch
workspaces, and load an organization-scoped shell. Tenant creation is not shown
in the chooser; empty state directs users to the platform operator or an
invitation workflow.

The organization shell uses a neutral canvas with a persistent desktop sidebar.
Expanded and collapsed sidebar modes both provide organization switching; the
collapse preference is stored locally when browser storage is available.
Navigation preserves role-aware visibility and marks both directory and detail
routes active without matching unrelated route prefixes.

Organization switchers have unique popup IDs, keyboard arrow/Home/End navigation,
current-organization semantics, Escape dismissal, and request retry feedback.
The mobile Menu opens a native modal navigation drawer, with a close action,
Escape/backdrop dismissal, scroll containment, and focus restoration. Selecting
a destination or entering the desktop breakpoint closes the drawer.

Organization selection uses a labeled search toolbar and divided workspace rows
with visible role context. Loading, no memberships, no search matches, and failed
requests have distinct feedback. Tenant creation is intentionally not available
in this UI; the platform operator provisions the organization through the
protected server-side command described above, then activates it separately.

The overview links to existing branches and account settings for all members, and
merchant profiles/products for owners, managers, and merchants. Owners also see
the Payment Accounts destination for configuring custom accounts; the system Cash
account is created with the organization and is always available to all branches.
Members navigation
is owner-only. The overview presents those role-aware destinations in a centered
warm-neutral canvas with responsive rounded section cards. Catalog destinations use
backend-filtered records, not a full-tenant catalog for nonowners. It shows the
authenticated organization role as a right-aligned header access status, not mock
financial metrics. Backend guards remain authoritative. Organization identity
responses do not embed branch summaries,
counts, or access grants.

Workspace scope changes reset cached data. Access refresh clears branch cache;
obsolete branch responses cannot restore data from an earlier access scope.
The branch directory refreshes accessible branches on entry. Access checks are
performed by the backend on current membership/assignments, not cached JWT claims.

The persistent organization workspace holds one in-memory selected branch ID shared
by POS, Inventory and Reports. Each feature validates the remembered choice with
its own authorized branch lookup before reusing it; remembering an ID is never an
access grant. With no choice, the existing explicit picker remains. If unavailable
for the destination, that feature shows its picker/access feedback without choosing
an alternative or erasing a choice still valid for another feature.

Validated explicit branch routes take precedence. Dropdown changes update the
shared choice only after navigation/write/unsaved-change guards allow the change.
Organization switching resets the choice, including returning to the old tenant;
user changes/sign-out reset both choice and workspace caches. Current role changes
clear the choice permanently. Same-role access refresh retains the preference but
forces feature lookups to revalidate; callbacks from older access generations
cannot overwrite it. No local/session storage, full-reload persistence, form/date
preference or new API/schema is added.

Shared branch integration passes frontend formatting, lint, type checking, build
and 702 tests across 83 files. The 22 new tests cover cross-page reuse, authorized
direct-route precedence, explicit empty choices, feature-specific access, merchant
historical Reports versus Inventory/POS, tenant/user/role resets, access-refresh
callback invalidation, late lookups, cancelled changes and unresolved checkout/
refund locks. New rendered navigation/dropdown/focus QA remains the final part;
earlier milestone waivers do not cover this refinement.

Final shared-branch frontend regressions were rerun successfully: changed-file
formatting, lint/type checking, 702 tests across 83 files and production build.
Backend/schema/database behavior is unchanged; no Docker/database checks were
needed. Unrelated edits and the existing multiple-lockfile build warning were
preserved. The user explicitly waived rendered page-switching/dropdown/keyboard/
focus QA for shared branch selection on September 14, 2026, separately from earlier
milestone waivers. Those checks were not performed; automated checks do not certify
rendered layout or accessibility. Both parts were reviewed and approved; the
[completed shared branch-selection plan](../plans/archive/shared-branch-selection-2026-09-14.md)
is archived.
