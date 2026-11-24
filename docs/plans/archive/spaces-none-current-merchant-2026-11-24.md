# Spaces empty current merchant display

Approved by the user and completed November 24, 2026.

The Spaces table now displays `None` in the Current merchant column when a
space has no current occupancy. This is a frontend presentation change with a
focused regression assertion; API and database behavior are unchanged.

Verification: the focused vacant-space assertion passed, formatting and
typechecking passed. The existing inline space-type test fails independently
because its expected dialog text is absent.
