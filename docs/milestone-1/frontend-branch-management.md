# Frontend Branch Management

## Scope

This Milestone 1 part connects the selected organization workspace to the branch API. It provides:

- organization workspace navigation
- branch listing and physical-address display
- branch creation and editing for owners and managers
- read-only branch visibility for cashiers and merchants
- loading, empty, validation, API-error, and pending states

Branch deletion, staff assignments, inventory, POS devices, maps, geocoding, operating hours, and merchant-domain features are excluded.

## Route

`/app/organizations/:organizationId/branches`

The route loads the selected organization and its branches through authenticated requests. The backend revalidates membership and authorization for every operation.

## Role behavior

| Operation | Owner | Manager | Cashier | Merchant |
| --- | --- | --- | --- | --- |
| View branches | Allowed | Allowed | Allowed | Allowed |
| Create branches | Allowed | Allowed | Hidden and denied | Hidden and denied |
| Edit branches | Allowed | Allowed | Hidden and denied | Hidden and denied |

The interface uses the role returned by the backend to avoid presenting unavailable controls. This is a usability measure only; backend RBAC remains authoritative.

## Forms and validation

- Required: name, address line 1, city, province/region, and two-letter country code.
- Optional: code, address line 2, and postal code.
- Branch codes are uppercased and validated against the backend format.
- `PH` is the initial country-code value because the confirmed initial market is the Philippines; users may still enter another valid two-letter code supported by the backend.
- Server conflicts and validation failures remain visible without discarding entered form values.
- Required fields expose native required semantics, and failed validation moves focus to the first invalid field.
- Entering edit mode moves focus to the form heading, and successful saves are announced through a status message.

## Design

The surface extends `DESIGN.md` in Operate mode. It uses flat bordered panels, comfortable operational density, explicit labels, responsive task order, and the established emerald/slate palette. No new global visual pattern is introduced.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
