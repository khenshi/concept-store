# Frontend Architecture

**Status:** Current foundation reference

The Next.js application separates public landing, authentication, and invitation
acceptance pages from authenticated account and organization workspaces.

The organization provider loads only the active organization and its branches.
The responsive organization shell exposes Overview and Branches to members and
adds Members for owners and managers. Account settings remain globally
available to authenticated users.

Feature folders contain the retained API clients, types, schemas, components,
and tests for authentication, accounts, organizations, branches, memberships,
and invitations. Later business feature components and routes are not retained.

Tailwind CSS remains the styling standard, using restrained emerald accents,
slate neutrals, semantic HTML, visible focus states, clear request feedback,
and responsive layouts. Frontend visibility improves usability; backend guards
and service checks remain the authorization boundary.
