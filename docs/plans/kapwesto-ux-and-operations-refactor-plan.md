# Kapwesto UX and Operations Refactor — Initial Plan

**Status:** Implemented September 2026
**Product name:** Kapwesto  
**Tagline:** Connecting Spaces, Brands, and Business.

## Goal

Improve navigation clarity, page density, and common operational workflows while
preserving tenant isolation, financial history, and the existing modular
architecture. Deliver the work in focused parts so visual changes do not become
coupled to financially sensitive sale and agreement changes.

## Product Decisions

### Completed sales

- Allow an authorized owner or manager to **void** a completed sale.
- Do **not** allow editing a completed sale. Editing historical items, prices,
  merchant attribution, or payments would make inventory and settlement history
  unreliable.
- Continue using the existing refund flow for returned items. Block voiding a
  sale that already has a refund or has activity included in a locked settlement.
- A void must require a documented reason, reverse inventory atomically, exclude
  the sale from live merchant payables and reports, and retain the original sale
  as an auditable record.

### Products

- Do not add hard deletion. Use the existing active/inactive lifecycle and label
  the action clearly as **Deactivate product**. Historical sale and inventory
  references must remain intact.
- Display the product creation date as secondary row information.
- Allow optional initial stock during product creation for one selected eligible
  branch. Create the product and its initial stock movement atomically; zero or
  omitted stock creates only the product.

### Reports

- Retire the current duplicated operational Reports page and remove its sidebar
  link.
- Keep sales history in POS and inventory/movement history in Inventory.
- Move the merchant financial summary into a **Merchant activity** tab inside
  Merchant Finance, with period, branch, and merchant filters and links to the
  relevant merchant/payable details.
- Preserve owner and merchant dashboard reporting. Remove report endpoints and
  frontend types only when no dashboard or other consumer still uses them.

### Agreement details

- Remove the standalone agreement detail page only after the agreement row action
  opens a modal or drawer with complete term details, status, activation, editing,
  ending, and relevant history.
- Keep deep actions server-authoritative and preserve historical agreements. The
  organization and merchant agreement lists remain the primary entry points.

## Part 1 — Brand, Assets, and Shared Navigation

### Kapwesto branding

- Replace user-facing “Concept Store” product branding with **Kapwesto** in the
  wordmark, browser metadata, authentication/public screens, accessibility labels,
  and API documentation title where it describes the software product.
- Add the tagline to the public/authentication brand presentation without
  repeating it in compact application navigation.
- Do not rename domain language such as “concept store,” organizations, database
  models, environment variables, package names, or existing migrations.

### Brand asset directory

- Add `frontend/public/brand/` with a README documenting supported assets and
  stable names: `logo.svg`, `logo-dark.svg`, `mark.svg`, `favicon.svg`, and
  optional raster social/manifest images.
- Make the wordmark fall back to a styled **K** mark and text when custom image
  files have not yet been supplied. Do not commit placeholder binary artwork.

### Collapsible organization sidebar

- Add a desktop collapse control to the organization workspace shell.
- Expanded state shows icons and labels at the current width. Collapsed state uses
  an approximately 72px rail with centered icons; group headings become horizontal
  divider lines.
- Use a small internal SVG icon set rather than adding an icon dependency. Every
  icon-only destination must keep an `aria-label`, active indication, and tooltip.
- Persist the desktop preference in local storage after hydration. Keep the
  existing mobile menu behavior independent from desktop collapse state.
- Ensure the content column expands when collapsed and that focus, keyboard
  navigation, printing, and role-based destination visibility continue to work.

### Back navigation

- Add one shared button-styled back-link component using Next.js `Link`. It should
  remain semantically a link while visually appearing as a secondary button with
  a left-arrow icon, border, background hover, and visible focus state.
- Replace plain underlined back links on sale details, receipts, merchant details,
  settlement details, and live-payable details. Exclude ordinary inline links and
  retry actions.

## Part 2 — Branches, Spaces, and Assignments

### Branch directory

- Replace the stacked branch cards with one responsive table/list containing a
  single header row and one branch per row. Columns are **Branch**, **Code**,
  **Address**, and **Action**; the full address remains readable without repeating
  labels inside every row.
- Replace **Open workspace** with a **View** link to
  `/app/organizations/[organizationId]/branches/[branchId]` and remove the branch
  workspace drawer and its open/close state.
- Add automatically applied search across name, code, and address, plus a
  city/province location filter derived from the loaded branches. These filters
  are client-side because branch collections are organization-scoped and expected
  to remain small; text search uses the shared debounce convention.
- Move Add branch into an accessible modal. Remove the beside-the-list form layout
  and reuse the existing branch schema, API, authorization, success handling, and
  context upsert behavior inside the modal.
- Keep Edit out of directory rows. The only directory action is View.

### Branch detail page

- Add a tenant-scoped branch detail route with the shared button-styled Back to
  branches link, complete branch identity/address information, and quick links to
  branch-filtered Spaces, Inventory, and POS sales history.
- Add a compact branch overview endpoint returning the authorized branch and only
  these useful statistics: today’s completed sale count and gross sales, total
  inventory units and out-of-stock product count, total/occupied/vacant spaces,
  and active merchants currently assigned to its spaces.
- Calculate statistics server-side with organization and branch constraints. Use
  precise decimals for money, exclude voided sales once sale voiding exists, and
  avoid loading transaction or inventory row details just to count them.
- Put **Edit branch** on this page and open the same branch form as a modal. Update
  the page data and shared branch context after saving without navigating away.
- Provide separate skeleton, not-found, forbidden, and retry states. Guessed IDs
  must never reveal cross-organization branch existence.

### Space directory

- Replace the stacked space list with one responsive table containing a header and
  one space per row. Columns are **Space**, **Code**, **Type**, **Merchant**,
  **Status**, and **Action**.
- Preserve the existing branch selector and automatic search/type/status/merchant
  filters. Keep Add and Edit space in their existing modal workflow.
- Use an em dash for unassigned merchants and vertically center badges/actions so
  each row remains visually consistent.

### Assignment management

- Keep the assignment register table and filters, but open **Manage** and **Assign**
  in a centered accessible modal instead of rendering the management widget below
  the table.
- The modal owns focus trapping, Escape/backdrop close when idle, pending-state
  close protection, and focus return to the triggering row action.
- Preserve the current create/end assignment validation, exclusivity rules,
  history, tenant checks, and post-save refresh. Remove the old bottom-widget
  container after modal parity is verified.

### Merchant directory rows

- Replace the current stacked merchant list presentation with one responsive table
  containing a single header row and one merchant per row. Columns are
  **Merchant**, **Code**, **Contact**, **Branches**, **Status**, and **Action**.
- Keep search/status filters and Add merchant behavior unchanged. Vertically center
  status and View, and keep View as the only row action; editing remains on the
  merchant detail page.

## Part 3 — POS and Sales

### New sale

- Join the product search control and search-results list into one bordered
  surface with no external gap between them. Keep branch selection and quick code
  entry as distinct cards.
- Autofocus the SKU/barcode input when the page is ready and a branch is selected.
  Restore focus after a successful quick add and when starting another sale; do
  not steal focus while a modal is open or after an invalid-code warning.

### Sale history and details

- Add **Clear dates** beside the date range and **Clear all filters** for search,
  branch-independent filters, dates, and payment method. Keep the currently
  selected selling branch unless the user explicitly changes it.
- Rename **Receipt** to **View receipt** and style it as a prominent secondary
  action with a receipt/external-navigation icon and normal hover/focus feedback.
- Add the void action only on eligible completed sales. Show a confirmation modal
  requiring a reason and clearly state that inventory and merchant balances will
  be reversed.

### Void-sale backend contract

- Add a `SaleStatus` lifecycle with `COMPLETED` and `VOIDED`, plus immutable
  `voidedAt`, `voidedById`, and `voidReason` audit fields.
- Add an owner/manager-only tenant- and branch-scoped void endpoint. The service
  must lock/revalidate the sale, reject already voided, refunded, or settled
  activity, restore inventory, create explicit reversal inventory movements, and
  mark the sale voided in one database transaction.
- Update sales history, receipt/detail responses, reports, and live payable queries
  to expose status and exclude voided financial activity. A voided receipt remains
  viewable and is visibly marked **VOIDED**.
- Add indexes only for demonstrated status/date query patterns; preserve all
  original sale, item, payment, and merchant snapshots.

## Part 4 — Products and Inventory

### List presentation

- Use table-shaped loading skeletons matching Sales History for Products,
  Inventory, Branches, Spaces, and Merchants. Skeletons must preserve approximate
  column widths and row heights to reduce layout shift.
- Add product creation date to product rows using the existing `createdAt`; no
  schema change is required.
- Vertically center merchant status and View actions within each merchant row.

### Optional initial stock

- Extend product creation input with optional `initialStock` containing
  `branchId`, positive integer `quantity`, and optional note/reference.
- Validate that the branch belongs to the organization and is one in which the
  merchant participates. Derive organization, product, and actor data on the
  backend.
- Create Product, Inventory, and `STOCK_IN` movement records in one transaction.
  Existing product creation without initial stock remains compatible.
- Show the initial-stock controls as an optional section in the add-product modal;
  do not show them while editing an existing product.

### Movement history date filters

- Add optional **From** and **To** dates to the movement-history query DTO, API
  client type, and UI. Dates apply automatically, reset cursor pagination, and
  reject an inverted range without requesting data.
- Interpret From as start-of-day and To as end-of-day in the organization’s
  current Manila business-time convention. Add an organization/date index if query
  analysis confirms the existing branch/product date indexes do not cover the
  unscoped history query.

### Adjust inventory modal

- Move current on-hand stock into a prominent top-right summary badge/card while
  retaining product and branch context.
- Add a mode selector: **Change by amount** or **Set new stock total**.
- Extend the adjustment API input so exactly one of `quantityChange` or
  `newQuantity` is accepted. For a new total, the backend must read the current
  quantity inside the transaction, calculate the delta, reject a negative total,
  and record the calculated delta in the existing movement audit trail.
- Require the existing documented reason in both modes. Display the projected new
  stock before submission and reject a result below zero.

## Part 5 — Merchant Profile and Agreements

### Merchant details layout

- Order content as: compact merchant header → workflow navigation cards → current
  agreement → profile/branch widgets.
- Move the lifecycle status into the merchant profile widget below the merchant
  details. Show only a **Status** label and controlled dropdown.
- On selecting a different status, open the shared confirmation dialog. Save only
  after confirmation; on cancel or API failure restore the persisted value. Remove
  the separate Update status button and explanatory lifecycle copy.
- Keep status authorization and tenant checks unchanged on the backend.
- Open profile editing in a focused modal populated from persisted merchant data.
  Keep the read-only profile widget visible behind it, validate with the existing
  schema, close only after success, and return focus to Edit.

### Agreement term validation

- Require at least one positive commercial term: fixed rent, commission, or both.
  An agreement with both values absent is invalid in DRAFT as well as ACTIVE state.
- Add matching frontend schema validation and backend service/DTO validation; the
  backend remains authoritative. Preserve the existing decimal limits and reject
  zero-valued terms.
- Apply the same invariant to create and draft update operations. Before rollout,
  query existing agreements without terms; remediate them explicitly rather than
  silently inventing financial values.

### Agreement list workflow

- Expand each agreement row/modal trigger to show the exact rent and/or commission
  values in addition to type, term dates, schedule, and status.
- Move edit, activate, and end actions into the agreement modal/drawer with the
  same confirmations and date validation currently provided by the detail page.
- After feature parity and route-link cleanup, remove the agreement detail route
  and its page-only components. Keep backend get-by-ID behavior if the modal needs
  it; remove it only if verified unused.

## Data Migration and Compatibility

- Add the sale-void fields and status with existing sales backfilled as
  `COMPLETED`; do not rewrite historical payments or sale items.
- Before enforcing agreement-term validity against existing data, produce an audit
  query/report of termless agreements. Block new invalid writes immediately, but
  migrate old records only with an explicit value supplied by the owner or a
  documented decision to end the agreement.
- Product creation remains backward-compatible because `initialStock` is optional.
- Inventory adjustment remains backward-compatible with `quantityChange`; the new
  total mode is additive.
- The branch detail route and overview response are additive. Existing branch list,
  create, and update contracts remain compatible; the drawer has no persisted data
  and can be removed without migration.

## Testing and Acceptance

### Navigation and branding

- Verify all role-specific destinations in expanded and collapsed states,
  persistence after reload, icon labels/tooltips, keyboard focus, mobile menu, and
  content resizing.
- Verify Kapwesto name/tagline and brand asset fallbacks across public, auth, and
  authenticated layouts.
- Verify every detail-page back action is visibly button-like and routes to the
  correct tenant-scoped parent page.

### Branches, spaces, and assignments

- Verify branch search/location filters, table headers and rows, modal create/edit
  focus behavior, detail routing, context refresh, responsive overflow, and removal
  of the workspace drawer.
- Test branch overview statistics with no activity, sales across midnight in the
  Manila business timezone, voided sales, empty inventory, occupied/vacant spaces,
  and cross-tenant branch IDs.
- Verify space and merchant tables preserve all displayed data and automatic
  filters on desktop and narrow screens.
- Verify assignment Manage/Assign opens in a modal, returns focus on close, blocks
  accidental closure while saving, refreshes the register after success, and
  preserves assignment history/exclusivity.

### POS and sale integrity

- Test quick-code autofocus/refocus without modal focus theft.
- Test clearing dates and all filters while preserving branch selection.
- Test void authorization, cross-tenant denial, duplicate void rejection,
  refunded/settled-sale rejection, atomic inventory restoration, reversal
  movement creation, financial exclusion, and voided receipt display.
- Verify no endpoint permits editing a completed sale.

### Products and inventory

- Test skeleton states, product creation date display, deactivation behavior, and
  absence of hard delete.
- Test product creation with no stock and with valid/invalid cross-tenant initial
  stock, including transaction rollback on inventory failure.
- Test movement date boundaries and pagination reset.
- Test adjustment-by-delta and set-total modes, concurrent stock changes, negative
  result rejection, and exact audit movement deltas.

### Merchants and agreements

- Test merchant-row alignment, modal profile editing, confirmed/cancelled status
  changes, failure rollback, and authorization.
- Test agreement create/update rejection when both terms are absent and acceptance
  of rent-only, commission-only, and combined agreements.
- Verify agreement modal parity before deleting the detail route and confirm no
  stale links remain.

- Run backend and frontend lint, typecheck, unit/integration tests, migration
  validation, and production builds after each part.

## Suggested Commit Sequence

1. `chore(brand): introduce Kapwesto identity and brand assets`
2. `feat(navigation): add collapsible icon sidebar and back buttons`
3. `refactor(branches): use directory rows and modal creation`
4. `feat(branches): add branch details and operational statistics`
5. `refactor(spaces): standardize space rows and assignment modal`
6. `refactor(pos): improve new-sale and sales-history interactions`
7. `feat(sales): add auditable sale void workflow`
8. `refactor(catalog): improve product merchant and inventory loading states`
9. `feat(products): support transactional initial stock`
10. `feat(inventory): add movement dates and set-total adjustments`
11. `refactor(merchants): streamline directory and profile workflows`
12. `fix(agreements): require commercial terms on every agreement`
13. `refactor(agreements): consolidate details into list modal`
14. `refactor(reports): move merchant activity into finance`
15. `docs: update Kapwesto workflows and architecture`

## Out of Scope

- Editing completed sales
- Hard-deleting products, sales, agreements, or financial history
- Automatic payment-gateway reversals
- A new third-party icon library
- Changes to tenant ownership or role definitions
- Replacing operational history with a new generalized reporting framework
