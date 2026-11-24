# Payment account branch assignment modal

**Status:** Implemented November 24, 2026.

The create/edit payment-account modal now places branch assignment on the right,
always renders the branch list in a fixed-height scrollable container, hides the
redundant branch search for this local list, and uses an All branches switch.
Existing assignment modes and save payloads are preserved. Payment-account tests,
typecheck, and formatting passed.
