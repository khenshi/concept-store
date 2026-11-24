# Space assignment toggle order

**Status:** Implemented November 24, 2026.

## Approved scope

Move the existing completed-past-occupancy switch in the Assign space modal so
it appears between merchant/space selection and date selection. Preserve its
behavior and validation.

## Implementation and validation

The existing switch was moved in the AssignmentForm markup without changing its
state, disabled conditions, or date behavior. Focused Spaces assignment,
completed-occupancy, and conflict tests passed; frontend typecheck, formatting,
and diff checks passed.
