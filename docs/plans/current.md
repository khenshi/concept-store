# Current Implementation Plan

**Status:** Approved September 17, 2026. Deliver in reviewable, uncommitted
parts. Commit each part only after approval, then start the next.

## Divider-led application redesign

### Intent and interpretation of the reference

Keep Kapwesto's warm-neutral foundation and editorial hierarchy, but make
application pages visually calmer and easier to scan: broad paper surfaces,
deliberate whitespace, aligned content, subtle hairline dividers and row-based
information instead of stacks of rounded cards. This is **not a monochrome
redesign**: use a small, consistent set of purposeful colors where they clarify
meaning or action, without coloring every panel.
The supplied image is a layout/style reference, not a feature specification.
Do not add its profile panel, activity feed, tasks, upgrade prompt, fictional
metrics, or a new dashboard. Existing organization, branch and role navigation
remain recognizable and functional.

The scope is **all current application pages except the public landing page
`/`**: organization selection and workspaces, branch and role workflows,
account settings, login, registration, invitation preview/acceptance, and
application loading/empty/error surfaces. Focused auth/invitation/account
screens keep their appropriate narrow layouts; they adopt the lighter visual
language without inheriting the organization sidebar or dashboard composition.
The landing page is intentionally unchanged unless separately requested.

### Approved behavior to preserve if this plan is accepted

- No API, database, role, tenancy, payment, stock, sales or reporting business
  behavior changes. Keep existing route structure, filters, branch selectors,
  tabs, links, forms, dialogs, status feedback, print surfaces and responsive
  mobile navigation.
- Preserve semantic headings, labeled controls, visible keyboard focus,
  non-color status meaning, accessible list/table structure, loading/empty/error
  states, pending-write protection, and 200% zoom usability.
- Define a restrained color hierarchy in `DESIGN.md`: one controlled accent
  for primary/selected actions where useful, green for success/healthy status,
  amber for caution/low stock, red for errors/destructive or out-of-stock
  states, and a quiet informational treatment where needed. Keep ordinary
  text, borders and secondary controls neutral. Any added accent must have
  accessible text/focus contrast; status never relies on color alone.
- Retain modest rounding on inputs, buttons, menus and dialogs for affordance.
  Remove or substantially reduce rounded-card framing on ordinary page
  sections; use grouped rows/dividers and spacing to communicate hierarchy.
- Keep distinct boundaries where function requires them (e.g. a POS cart,
  destructive confirmation, chart plot, or scrollable table); avoid flattening
  everything into one undifferentiated column.

### Delivery by reviewable parts

1. **Visual foundation and one representative page.** Update `DESIGN.md` with
   the divider-led layout and restrained semantic/action color roles, and
   update shared operational layout/panel primitives. Then
   apply the pattern to the organization overview as a reference implementation.
   Review desktop and narrow-screen hierarchy before broad adoption. Stop
   uncommitted for review.
2. **Directories and details.** Apply the accepted pattern to Branches, Members,
   Merchants, Products, Inventory and Sales list/detail screens. Preserve
   existing data density, actions and branch-aware navigation. Use rows and
   light section separation rather than per-record cards. Stop uncommitted.
3. **Operational workspaces.** Align POS and Reports with the same visual
   language while keeping cart/checkout safety, charts, totals, filters,
   tabs, printing and merchant/staff distinctions clear. Stop uncommitted.
4. **Focused and entry pages.** Apply the same divider-led visual principles
   to organization selection, account settings, login, registration,
   invitation flows, and application loading/empty/error pages. Keep narrow
   task-first layouts, form clarity and public-route accessibility; do not
   add the workspace sidebar to these pages. Verify that the landing page
   remains unchanged. Stop uncommitted.
5. **Final verification.** Run changed-file formatting, frontend lint,
   typecheck, component/workflow tests and production build. Verify rendered
   desktop/tablet/mobile layouts for workspace and focused routes,
   keyboard/focus/dialog behavior, 200% zoom, and print-sensitive screens in a
   browser, or obtain a fresh explicit waiver for this milestone. Update
   `docs/modules/frontend-experience.md` and other affected module docs to
   reflect the implemented presentation. Stop for final review; commit and
   archive only after approval.

### Part 1 status (approved and committed)

The initial visual foundation adds a restrained, accessible muted-blue
operational accent without changing landing-page buttons; semantic notices
use a flat colored rule. A shared opt-in open section keeps legacy panels
stable while later pages migrate. The organization workspace gains an open
Paper content plane and its overview uses a divided list with its existing
role-scoped links and role label. No backend or workflow behavior changes.
Frontend formatting, lint, typecheck, production build and all 785 tests pass.
No browser surface is connected, so rendered desktop/narrow-screen review was
not performed before Part 1 approval.

Part 1 was approved and committed as `251a259`.

### Part 2 status (uncommitted, awaiting review)

Branches, Members, Merchants, Products, Inventory, and Sales list/detail
sections now use the shared open, divider-led treatment. Directory toolbars use
the paper surface rather than inset shaded cards, and primary directory actions
use the restrained accent. Existing record rows, branch selectors, role-specific
content, dialogs, forms, status treatments and API behavior are unchanged.
Rendered review is still pending because no browser is connected. This part
must be reviewed before it is committed or Part 3 begins.

### Exclusions

- No new dashboard data, activity feed, user avatars, subscription/upgrade UI,
  charts, tasks, or other features copied from the reference image.
- No new frontend state framework, component library, icon system, design
  tokens unrelated to this visual direction, or backend/infrastructure work.
- The public landing page `/` is excluded. Product-directory pagination
  remains a separate future plan; this visual change must not silently
  implement it.
- Preserve the unrelated root `package.json`, `package-lock.json`, and
  performance-audit draft.

### Acceptance checks

- A user can identify the page title, current organization/branch context
  where relevant, primary action, filters, results and secondary details
  without card clutter.
- Lists and detail sections have consistent alignment and clear dividers at
  wide and narrow widths; repeated rounded containers are no longer the
  primary organizing device.
- Primary actions and meaningful statuses are visually distinguishable with a
  restrained, consistent accent/semantic palette; pages are not grayscale,
  but color is never the only indication of state or priority.
- Role-specific screens show exactly the same information and controls as
  before, with no unauthorized content revealed through the redesign.
- Existing navigation, forms, dialogs, loading/error feedback and POS/Reports
  workflows continue to pass automated and applicable rendered checks.
- Login, registration, invitation, account and organization entry retain
  their task-first structure and all existing auth/access behavior; the
  landing page remains visually unchanged.
