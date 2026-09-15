# Current Implementation Plan

**Status:** Approved September 15, 2026. Implementing by reviewable parts; each
part remains uncommitted until reviewed and approved.

Part 1 was reviewed and approved. Focused automated tests pass. Part 2 is now in
progress and will remain uncommitted until review.

## Inventory workflow and branch workspace usability

### Product decisions

- Replace the separate **Find a product** input and **Product** dropdown in the
  Add product placement modal with one accessible searchable product picker.
  Typing filters eligible products and selecting a result completes the choice;
  the selected product remains visible and can be changed before submission.
- Keep a reason required for manual stock receipts and corrections. The reason is
  part of the immutable movement ledger and distinguishes deliveries, recounts,
  damage and other manual changes during later investigation. Reduce typing by
  offering suitable common reasons while retaining a custom-reason choice and the
  existing backend validation.
- Put **Receive stock** and **Correct stock** beside each other on inventory-detail
  pages when the viewport can fit them, and stack them on smaller screens. Keep
  branch price editing and movement history as separate sections.
- Add compact **Receive stock** and **Correct stock** actions to each writable
  inventory-directory row. Each action opens a focused modal for that placement,
  while the product name/details area continues to open the inventory detail page.
  Merchant rows remain read-only and expose no mutation actions.
- Present Inventory, POS and Sales as a responsive three-column action group on
  branch detail pages when all three are available and space permits. Stack or
  reduce columns at narrower sizes and naturally omit role-inaccessible actions.
- Group workspace navigation into **Branch operations** and **Organization**.
  Branch operations contains the visible branch-scoped destinations: POS,
  Inventory, Sales and Reports. Organization contains Overview, Branches,
  Merchants, Products and Members. Existing role visibility and active-route
  behavior remain authoritative.
- Put the branch selector in the right-side action area of the page header on
  branch-scoped POS, Inventory, Sales and Reports directory/workspace pages and
  their applicable detail screens. It aligns with the title block on wider
  screens and stacks cleanly below it on small screens. The selector remains
  explicitly labeled and preserves the shared remembered-branch behavior and all
  existing navigation/write guards.

### Smallest complete scope

- Build or adapt a reusable accessible searchable single-select control for the
  placement modal. Preserve the current debounced server-side product search,
  eligibility rules, loading/error/empty states, live validation, selected-item
  stability and modal pending/dismissal protection.
- Add receipt/correction modal state to the inventory directory without weakening
  the existing stock command protections: UUID retry idempotency, 300 ms live
  validation, immediate blur/submit validation, adjustment confirmation, balance
  refresh, movement-ledger integrity, access-loss handling and one-write-at-a-time
  exclusion.
- Refresh the affected inventory row after a successful quick action and provide
  clear success/error feedback. A successful command must use server-refreshed
  stock and must not treat a replayed movement balance as current quantity.
- Add predefined receipt and correction reason choices in the frontend while
  continuing to submit the existing validated reason string. Custom text remains
  available so operational cases are not artificially constrained.
- Recompose existing branch-detail actions, navigation destinations and page
  headers without changing their URLs or authorization rules.
- Apply one consistent header selector pattern across the existing branch-scoped
  operational surfaces. Branch switching must still clear or preserve scoped
  state exactly as each existing workflow requires, and cancelled/blocked changes
  must retain the current branch and drafts.
- Update the affected module documentation after each implemented part.

### Explicit exclusions

- No backend route, database schema, stock arithmetic, movement type, authorization
  role or branch-assignment change.
- No removal or optionalization of movement reasons, no editable/deletable movement
  history and no inventory transfers, purchasing or supplier workflow.
- No quick branch-price action in the directory; price editing remains on the
  inventory detail page for this milestone.
- No bulk stock operation, multi-product receipt, pagination, new persisted user
  preference or change to shared branch-selection semantics.
- No redesign of report content, POS checkout, sales-detail content, product
  creation/opening stock or organization overview beyond the specified layout and
  selector placement.
- Preserve unrelated Inventory API, root package and performance-audit changes.

### Delivery by parts

1. **Placement picker and inventory-detail layout.** Replace the two-step product
   search/dropdown with one searchable picker; add common/custom reason selection;
   place Receive stock and Correct stock side by side responsively. Add focused
   component tests and update Branch Inventory/frontend documentation. Stop
   uncommitted for review; commit only after approval.
2. **Inventory-directory quick actions.** Add role-aware Receive stock and Correct
   stock row actions and focused modals using the established stock-command logic.
   Verify refresh, retry/idempotency, confirmation, pending exclusion, access loss,
   row/detail navigation and responsive semantics. Stop uncommitted for review;
   commit only after approval.
3. **Branch-oriented information architecture.** Group sidebar destinations,
   recompose branch-detail Inventory/POS/Sales actions, and move selectors into the
   page-header action area across POS, Inventory, Sales and Reports. Preserve route
   highlighting, role visibility, shared branch memory, direct-route precedence and
   all blocked/cancelled navigation behavior. Stop uncommitted for review; commit
   only after approval.
4. **Final verification and delivery.** Run applicable changed-file formatting,
   frontend lint, type checking, full frontend tests and production build. Perform
   rendered responsive, modal, searchable-picker, keyboard/focus and 200% zoom QA
   if browser access is available; otherwise obtain a new explicit waiver for this
   milestone. Record results, stop for final review, then commit and archive only
   after approval.

### Acceptance checks

- Add product placement has one understandable product-selection control. Keyboard
  and pointer users can search, review, select, change and submit an eligible
  product without duplicate inputs; unavailable, already placed and inactive
  products remain excluded.
- Manual receipts and corrections retain meaningful ledger reasons. Common reasons
  are fast to choose, custom reasons validate live, and existing 2–500 character
  backend requirements remain enforced.
- On suitable screens, Receive stock and Correct stock appear in one row; on small
  screens they stack without overlap, clipped controls or inconsistent widths.
- Owners/managers can open receipt or correction modals directly from an inventory
  row. Merchants cannot see or invoke them. Successful writes refresh authoritative
  quantity, retries do not duplicate stock, and other rows/branches are unchanged.
- Branch detail places its available Inventory, POS and Sales actions in one row
  when space permits and maintains readable responsive behavior for every role.
- Sidebar groups branch-scoped and organization-wide destinations without changing
  permissions, URLs, active state, mobile navigation or collapsed-sidebar access.
- Branch-scoped operational pages show a consistently labeled selector at the
  right of the page header on wider screens and below the title on narrow screens.
  Selecting a branch still updates the shared workspace choice only after existing
  workflow guards allow navigation.
- Automated tests cover role visibility, tenant/branch scoping, selector state,
  stale-response protection, modal pending/dismissal behavior, live validation,
  adjustment confirmation and accessible labels/focus behavior. No existing POS,
  Inventory, Sales, Reports or branch-navigation regression is introduced.
