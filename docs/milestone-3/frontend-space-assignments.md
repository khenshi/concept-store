# Milestone 3: Frontend Space Assignments

## Scope

This part adds merchant occupancy management to the authenticated Spaces page. Owners and managers can open one space, view its current and historical assignments, assign an eligible merchant, and explicitly end the current assignment.

It does not add merchant agreements, per-space rent, commission or settlement calculations, future assignment scheduling, products, or inventory.

## User flow

1. Select an organization branch on the Spaces page.
2. Open **Assignments** for a space in that branch.
3. If the space is active and unoccupied, select an active merchant already participating in the branch and enter a start date.
4. If the space is occupied, review the current merchant and enter an end date to end the assignment.
5. Review all current and ended assignments in reverse chronological order.

Assignment history is loaded only after a space is opened. Merchant records are loaded at the same time and filtered in the interface to active merchants participating in the selected branch. The backend remains authoritative and revalidates space status, branch participation, tenant ownership, dates, and exclusive occupancy.

## Business rules represented

- One space can have at most one assignment without an end date.
- Only active spaces can receive an assignment.
- Only active merchants currently participating in the space's branch are offered for selection.
- Ending an assignment never deletes its history.
- End dates cannot precede assignment start dates.
- Assignment dates use `YYYY-MM-DD` business-date input.
- Fixed rent is not stored on a space assignment. Milestone 3 merchant agreements own fixed-rent and commission terms.

## Frontend structure

```text
frontend/src/features/spaces/assignments/
├── space-assignment-api.ts
├── space-assignment.schemas.ts
├── space-assignment.types.ts
└── space-assignment-management.tsx
```

API and schema behavior have focused unit coverage alongside these files.

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
