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

## Source boundaries

```text
src/
├── app/                         Route entry points and layouts
├── config/                      Environment parsing and configuration
├── features/
│   └── <feature>/
│       ├── api/                 Backend communication
│       ├── components/          Feature-owned UI
│       └── model/               Types, schemas, and client state
└── shared/
    ├── components/              Domain-agnostic UI and branding
    └── hooks/                   Domain-agnostic React hooks
```

Route modules should remain thin and delegate behavior to a feature. A feature
may use shared code and explicitly import another feature's contract when the
workflow requires it. Shared code must not import from a business feature.
Tests stay beside the source they validate so ownership remains visible as the
application grows. ESLint enforces the shared-to-feature dependency boundary.

Tailwind CSS remains the styling standard, using restrained emerald accents,
slate neutrals, semantic HTML, visible focus states, clear request feedback,
and responsive layouts. Frontend visibility improves usability; backend guards
and service checks remain the authorization boundary.
