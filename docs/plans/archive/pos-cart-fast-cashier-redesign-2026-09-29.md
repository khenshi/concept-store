# POS Cart Fast Cashier Redesign

**Status:** Implemented September 29, 2026.

Redesigned the branch POS Cart interface for fast cashier workflows, primarily
on iPad landscape, using the existing Kapwesto design system. Landscape uses a
roughly 62/38 product-browser/cart split. The cart stays viewport-bounded with a
fixed header and checkout footer and an independently scrollable item list.
Portrait/narrow layouts show one product browser and a sticky cart summary that
opens the cart in a native bottom sheet. Optional in-app full-screen mode hides
the authenticated header and organization navigation, offers a clear exit, is
limited to the Cart route and is not persisted.

Existing POS APIs, catalog and branch authorization, cart state, exact code
lookup, repeated-scan quantity increments, scanner focus restoration, quantity
validation, payment/recovery, receipt and navigation-guard behavior were
preserved. Quick steppers reuse current quantity validation. Product rows show
name, merchant, SKU, price, available stock and Add. No backend, API, database or
checkout business rules changed.

## Verification

- POS/workspace/shell focused tests: 128 passed across 15 files.
- Frontend ESLint, TypeScript typecheck and production build passed.
- Full frontend test run: 854 passed, 3 failed. The failures are in existing
  tests for the separately modified Inventory movement and Sales workflow UI;
  their local labels changed from “From (PH)” to “From” and “Search receipt
  code” to “Search”. Those unrelated worktree changes were not modified.
- Rendered viewport QA was not performed because no browser surface was
  available. Automated layout and dialog tests do not certify rendered tablet,
  portrait or touch behavior.

No schema, migration or infrastructure changes were made. This archived plan is
a historical record and does not authorize additional implementation.
