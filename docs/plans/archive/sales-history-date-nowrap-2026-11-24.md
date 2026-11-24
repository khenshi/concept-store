# Sales history date wrapping

**Status:** Implemented November 24, 2026.

## Approved scope

Keep the calendar date in the sales history table on one line when the
responsive layout becomes tighter. Preserve the existing table layout and date
formatting.

## Implementation and validation

The staff sales-history date label now uses `whitespace-nowrap`, and its grid
column has a 10rem minimum so the full Date column remains usable as the
layout tightens. The sales workflow suite passed all 25 tests, frontend
typecheck passed, and the focused formatting check passed.
