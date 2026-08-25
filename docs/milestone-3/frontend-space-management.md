# Milestone 3: Frontend Space Management

## Scope

This part adds the owner and manager interface for managing branch-owned physical spaces.

It includes the organization navigation entry, branch selection, space directory, create and edit forms, typed API functions, Zod validation, responsive Tailwind presentation, and automated tests.

It does not add merchant space assignments, assignment history, merchant agreements, settlement calculations, or Milestone 4 functionality.

## Route

```text
/app/organizations/:organizationId/spaces
```

The route uses the shared authenticated application shell and organization navigation.

## Behavior

- Owners and managers can access the space-management interface.
- Other organization roles receive an explanatory restricted state and do not request protected space data.
- A branch selector determines which branch's spaces are loaded and created.
- Changing branches clears the current edit state and success message.
- The directory displays code, name, resolved type label, and lifecycle status.
- Create and edit operations update the local directory without requiring a full page reload.
- Space editing cannot move a space to another branch because the backend model treats branch ownership as stable.
- Organizations without a branch receive an empty prerequisite state.

## Validation

The frontend Zod schema mirrors the backend rules:

- code is normalized to uppercase and contains 2–32 letters, numbers, or internal hyphens
- name contains 2–120 characters
- type is one of rack, shelf, cabinet, booth, table, drawer, or custom
- custom type contains 2–80 characters and is required only for `CUSTOM`
- status is active or inactive

The backend remains authoritative for tenant access, branch ownership, uniqueness, and business rules.

## Styling

All presentation uses Tailwind utilities. The interface follows the approved restrained B2B design with white operational panels, slate borders, emerald actions and active states, responsive grids, accessible labels, and visible loading, empty, error, success, and restricted states.

No page-specific styles were added to `globals.css`.

## Validation commands

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
