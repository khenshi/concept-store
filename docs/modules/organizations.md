# Organizations

**Status:** Implemented

## Responsibilities

- Create a concept-store organization.
- List organizations available to the authenticated user.
- Load one organization through membership-derived access.
- Switch between accessible organization workspaces.

## API

```text
POST /organizations
GET  /organizations
GET  /organizations/:organizationId
```

## Rules

- Creating an organization also creates an `OWNER` membership for the creator.
- Organization access is derived from `OrganizationMembership`; possession of
  an organization UUID does not grant access.
- An unavailable or foreign organization is returned as not found.
- Organization IDs use UUID v4 validation.

## Data

`Organization` is the tenant root. Tenant-owned modules reference its ID and
must enforce the global isolation rules in `AGENTS.md`.

## Frontend

Authenticated users can create organizations, view their available
organizations, switch workspaces, and load an organization-scoped shell.

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
requests have distinct feedback. Creation opens a scroll-contained native dialog
with an explicit description, initial name-field focus, field validation, pending
feedback, and disabled dismissal during submission. Successful creation closes
the dialog and opens the new workspace overview; failure leaves it available for
correction/retry. The original organization validation and creation contract are
unchanged.

The overview links to existing branches and account settings for all members, and
merchant profiles and members for owners/managers. It shows the authenticated
organization role, not mock financial metrics. Backend guards remain authoritative.
