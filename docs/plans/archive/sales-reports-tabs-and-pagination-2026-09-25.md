# Sales Reports tabs and paginated tables

## Completed

Implemented Inventory-style Overview, Daily Data, and Rankings tabs for staff
and merchant Sales Reports. Overview retains the existing cards and charts.
Daily Data uses ten-row client-side pagination. Rankings uses a tenant- and
role-scoped server endpoint with ten-row pages, stable saved product ordering,
and role-specific response fields. Tabs and the title-cased Refresh Report
action share one row, and date range and branch filters persist while switching
tabs.

Updated frontend/backend contracts, focused tests, and Reports module
documentation. No schema, migration, or database changes were required.
