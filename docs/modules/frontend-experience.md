# Frontend Experience

## System typography

The application uses the platform system sans stack globally through the root
layout and shared base styles, covering public, authentication and authenticated
workspace routes. Apple devices resolve the stack to San Francisco; Windows and
Android use their native system alternatives. Existing type sizes, weights, line
heights, tracking, color semantics and responsive layouts remain unchanged. The
default Graphite canvas is `#F2F2F2`; white surfaces and alternate account theme
canvases remain unchanged.

This is a presentation-only change. No API, database, authorization, tenant,
branch or business behavior changed.

## POS loading headers (October 20, 2026)

POS retains its page heading and description while access/branch reads load;
the shared loading treatment covers only branch selection and page content.

## Shared card surfaces (October 13, 2026)

Card-like surfaces across the public landing page, guest flows, organization
workspace, account settings, branch/inventory/space workflows, POS, reports and
collection views use the shared `card-surface` treatment. The default light
theme uses the white Paper surface with a 20px (`1.25rem`) radius, no outer
border and no shadow. The theme-aware surface token adapts the fill for dark
themes while preserving the same geometry. `data-surface` uses the same
borderless geometry for structural collections; internal row and section
dividers remain available where they improve scanning. Pills, inputs, tabs,
semantic notices, popovers and dialogs retain their own interaction or feedback
geometry. This presentation change does not alter routes, data, authorization,
tenant isolation or business behavior.

## Shared form modal shell (October 20, 2026)

Ordinary form modals share `FormDialog` for their surface, heading typography,
description spacing, responsive padding, scroll containment, initial focus,
focus restoration and pending dismissal protection. Merchant creation, member
invitations, organization creation and the account deletion password form reuse
this shell alongside the existing operational forms. Feature components retain
their fields, validation, action rows, success views and business behavior.
Widths remain explicit variants to fit the workflow rather than forcing every
form to the same width. Account deletion retains alert-dialog semantics.

Confirmation prompts remain a separate shared pattern. Mobile navigation
drawers, the POS cart sheet and the calendar popover retain their specialized
layouts. These intentional variants share theme/backdrop tokens but are not
ordinary form modals.

## Shared modal backdrop blur (October 13, 2026)

Every modal path softens the page beneath it with the shared scrim and a 12px
backdrop blur while keeping the modal content crisp. Native `<dialog>` surfaces
use the global `dialog::backdrop` rule, including form dialogs, organization and
merchant modals, invitation flows, the mobile workspace drawer and the POS cart
sheet and account deletion. Custom confirmation alerts use the shared
`.modal-backdrop` class. Focus restoration, scroll locking, Escape and
pending-dismissal behavior remain unchanged.

## Inventory workflow refinement (Part 1, committed `3e34a8f`)

The branch Inventory page keeps its existing operational shell while exposing
Inventory stock and Stock integrity as staff-only tabs. Stock integrity is now
loaded only when its tab is opened, so the normal stock list does not start a
diagnostic request on page load. Owner and manager row actions are labeled
**Stock in** and **Adjust** while continuing to call the existing receipt and
adjustment workflows; their action buttons remain on one line at tablet widths.
The inventory search field has a leading search icon, and directory requests use
five-item cursor pages with the existing Load more behavior. Merchant read-only
visibility and all branch, role, tenant and stock safeguards are unchanged.

## Inventory placement modal refinement (Part 2, committed `ac3e67a`)

The add-placement modal now uses a product search bar as its picker. Focusing or
clicking the field opens the first five eligible products; typing reloads the
server-filtered results only after the existing debounce interval. Server pages
remain bounded to five products and retain cursor-based loading for additional
results. The picker keeps keyboard selection, focus return, loading, empty and
retry feedback, while the backend remains authoritative for branch eligibility.
Selling price and low-stock threshold fields share one row from small tablet
widths upward and continue to use the existing live validation.
Placement creation, tenant and branch checks remain unchanged. Rendered browser
QA remains unavailable for this focused refinement.

## Compact field validation feedback (Part 3, committed `8f53e73`)

Shared text-field and product-picker validation errors now sit beside their
field labels as compact red feedback rather than adding another block below the
input. Common long messages use short actionable copy while the original error
text remains available through the field's accessible description and hover
title. Existing debounced, blur and submit validation behavior is unchanged.
This is a presentation refinement only; no validation rules or API behavior
changed.

## Shared error and status feedback

Shared `Notice`, `StatusNotice` and `RequestError` surfaces use one responsive
feedback treatment: a one-pixel semantic border, a solid tinted background, a
meaningful outline icon, readable text hierarchy and a full-width retry control
on narrow screens. Request errors default to a clear `Something went wrong`
heading when no feature-specific title is supplied. Success, warning and error
announcements retain their existing status, note and alert semantics. The
compact field-validation treatment remains unchanged.

Branch-selector request errors mounted in a `PageHeader` occupy a full-width
row beneath the title and action area so the recovery surface is not confined
to the selector column. Standalone branch selectors continue to render their
request error beneath the selector.

Generic internal, unexpected-server and unhandled-exception messages from API
responses are normalized to the existing safe service-unavailable copy instead
of exposing implementation details. The authenticated session failure surface
now uses the shared error notice. Request callbacks, authentication behavior,
API contracts, authorization and tenant isolation are unchanged.

## Modal form action feedback

Form-level submission and validation feedback in modal forms generally appears
at the bottom-left of the modal action row, with the form actions kept on the
right. The merchant form keeps generic validation feedback with its fields and
places server request failures above the action row.
The shared `ModalActionRow` preserves the responsive wrapping and separator used
by the branch form across merchant, product, inventory, space, invitation,
organization, member-access, POS, refund and account-deletion forms. Field-level
validation remains beside its field, and loading or retry feedback remains near
the control whose data could not be loaded. Footer errors use compact red text
without a bordered notice, while the buttons stay aligned to the bottom-right.
This is a presentation-only change; form validation, request behavior,
authorization and tenant isolation are unchanged.

Modal dismissal actions such as Cancel, Close, Done and Return to cart use the
borderless quiet button treatment. Primary, danger and non-dismiss secondary
actions retain their existing emphasis and behavior.

Text-like inputs inside modal workflows use concise example placeholders that
match the expected value, including names, codes, quantities, prices, dates and
references. Select controls, radio buttons and checkboxes remain unplaceholdered
because their visible options or labels provide the input guidance.

## Placement opening stock and numeric fields (Part 4, uncommitted)

The add-placement modal now requires a nonnegative whole-number Initial stock value.
Selling price accepts numeric digits and a decimal point, while threshold and
opening stock accept whole-number digits; unsupported letters and characters are
removed as the user types. The fields continue to use the existing debounced
live validation and authoritative backend validation. The low-stock threshold
starts at `0` in the form; the backend's omitted-field API default remains `5`.
A valid placement creates
the branch balance and an attributed opening RECEIPT together, so the saved
quantity and movement history cannot diverge when opening stock is positive;
an explicit zero records no movement. Branch, organization, role,
duplicate-placement and tenant safeguards remain unchanged. Rendered browser QA
remains unavailable for this focused refinement.

Regular Receive stock actions no longer ask for a user-entered reason. The form
submits only the positive quantity and retry request ID; the backend records the
receipt with the system reason `Stock received`. Adjustment actions continue to
require a reason and retain their common-reason shortcuts.

## Inventory stock list refinement (Part 1)

The branch Inventory directory now uses an open Inventory Stock-style surface:
visible Product, SKU, Price, Quantity and Actions labels align with their records
on wide screens, while narrow screens retain the existing stacked layout. Product
identity stays grouped with merchant/status metadata without an underline hover
treatment; SKU is shown in its own column. The separate stock-status column is
removed; quantity text uses green, yellow, or red semantic color for the current
stock state and retains its threshold detail. Every row exposes a View action to
the placement detail, while
owners and managers also retain Stock in and Adjust actions. The search field
and existing merchant, product-status and stock-status controls remain
accessible but use quiet rounded reference-style controls. Add placement, branch
selection, pagination, role visibility and all data requests are unchanged. This
part was reviewed and committed before the remaining table surfaces are updated.
Stock-in and adjustment dialogs use the focused form-sized dialog treatment so
their short operational workflows do not expand to the wide default dialog. Long
dialog titles wrap naturally, while branch and current-unit tags sit in a
right-aligned metadata row below the description. Their form content uses the
dialog's existing inner edge, without a second nested padding layer.
While the branch list or Stock integrity check is loading, the page now uses a
five-row, column-aligned skeleton that preserves the table's responsive structure
instead of a generic list placeholder.

## Shared table pattern propagation (Part 2)

The approved Inventory Stock treatment now propagates through the remaining
comparable collections: Branches, Members, Merchants, Products, Inventory
movement/detail/reconciliation, Sales, refunds and Reports. Their existing
headers and responsive grids use quieter open surfaces, restrained hairlines,
aligned labels and consistent filter dropdown styling; Reports' true tables use
the same quiet header and row treatment without changing their horizontal
scrolling. Existing requests, actions, branch/role visibility, merchant privacy,
forms and business data remain unchanged. This part is now committed; rendered
browser QA remains unavailable.

## Organization chooser refinement (uncommitted)

The organization entry page now follows the supplied workspace-picker
composition: one unified Paper background, a spacious title/action header, a
compact search and result-count row, and a responsive two-to-three-column grid
of gently rounded organization cards. Cards use verified organization identity,
role context only; no member counts, activity dates,
sorting or dashboard metrics were introduced. The existing create dialog,
filtering, loading/error/empty states, focus restoration and navigation remain
unchanged. This focused change does not alter the public landing page or other
application routes. Automated checks pass; rendered browser review remains
pending because no browser surface is connected.

The operational accent is currently mapped to the neutral graphite scale rather
than blue. Semantic success, warning and danger feedback retain their meaning-
bearing colors; ordinary actions, navigation and chooser badges are monochrome.

## Dense directory surfaces (Part 1, committed `a8dddea`)

Branches, organization members, merchants and products now use one contained
data surface with a compact muted column header, aligned responsive record rows,
quiet metadata, semantic status/role tags and clear trailing targets or actions.
Rows remain links or controls with their existing labels and authorization; no
new columns, requests, sorting, bulk actions or data were introduced. The header
and nonessential columns collapse on narrow screens so the existing directory
filters, loading/error/empty states and keyboard targets remain readable. The
organization chooser remains its approved card grid, and POS/dialog-only lists
are unchanged. The implementation was reviewed and committed as `a8dddea`.

## Dense inventory and sales surfaces (Part 2, uncommitted)

Branch inventory placements, movement history, stock-integrity mismatches, branch
sales, merchant selling-branch history, own-sale items and refund history now use
the same contained data-surface language. Existing filters, date validation,
pagination, load-more controls, stock actions, refund actions, receipt links,
merchant-only projections and branch/tenant authorization are unchanged. Headers
and metadata collapse into readable stacks on narrow screens; no API, database,
query, totals or transaction behavior changed. Part 2 was reviewed and
committed as `db1bce9`.

## Dense Reports surfaces (Part 3, committed `827a3f6`)

The shared calendar Apply action uses a filled primary background; Reports labels
that action simply `Apply`.
Period and Report dates labels share muted extra-small, medium-weight typography
and matching label-to-control spacing.

Reports period controls provide Today, This month, Last 30 days, This year,
Last 12 months, Last 2 years, All time and Custom dates, with Today initially
selected. The shared custom preset dropdown and date selector share one row.
Presets apply immediately; calendar edits wait for Apply. The calendar selector displays
inclusive Philippine dates; the separate applied-period summary is removed.
Branch changes retain the chosen period, resolving
All time again for the authorized branch. Monthly charts replace daily charts
beyond 366 days, and yearly charts are used beyond five years. Grouped reports
keep exact daily detail through server pagination with 15 rows per page. Empty
All time explicitly states zero activity without an invented first date.

Exact daily analytics, top-product tables, payment breakdowns and refund-method
collections now use the same lightly contained table language. True tables keep
their horizontal scroller and numeric alignment; headers, consistent 1.5rem
column spacing, subtle row separators and method labels improve scanning without
changing charts, totals, date/branch filters, merchant privacy or report
calculations. The same spacing rhythm is applied to the existing directory,
Inventory and Sales list rows. Related identity metadata remains grouped in its
identity column while prices, quantities, statuses and actions use bounded
comparison columns.

## Shared collection warnings and pagination (October 12, 2026)

Tables and data collections now reuse the shared `EmptyState` warning box for
no-data and filtered-empty states. The box centers a concise title and optional
supporting explanation inside a lightly bordered subtle surface, with actions
kept below the message when a recovery or create action exists. This treatment
is used across directory, sales, inventory, spaces, refunds and Reports data
presentations; loading, request-error and authorization states remain separate.

Existing numbered and cursor-backed previous/next collections now reuse
`PaginationControls`: compact arrow buttons flank a centered page indicator,
while the existing count summary remains available at the start of the row.
The pagination footer sits directly below collection content with a shared
hairline separator; its previous/next controls are borderless arrow buttons
with preserved keyboard focus treatment. Empty page-based results keep the
disabled footer visible. Cursor-backed movement history keeps its existing page
cursor behavior and load-more collections keep their existing load-more
semantics. Existing paginated tables and lists use a consistent 15-row default;
filters, query contracts, data ordering, role visibility and tenant isolation
remain unchanged.

## Shared operational table shell (October 19, 2026)

All table and record-list surfaces use the shared `OperationalCollection` shell
for their title, description, action and control placement. Its `stacked`
variant keeps filters below the title and action, matching Inventory stock;
its `inline` variant keeps sorting and filtering beside the title, matching
Reports Transactions and Rankings. The compatibility `OperationalPanel`
wrapper preserves the same shell for existing non-collection panels. Feature
components continue to own their columns, rows, loading/error states, filters,
actions, numbered pagination and cursor-backed behavior. Reports' semantic
tables use the shared `OperationalTable` viewport and base table treatment;
Inventory and Spaces responsive list collections use the shared
`OperationalTableFrame` for the common empty-state inset and footer slot.
Paginated collection footers use the shared separator and borderless arrow
treatment. Responsive list collections remain semantic lists rather than being
forced into native HTML tables.

## Sidebar navigation icon semantics (October 12, 2026)

Organization workspace navigation uses distinct existing icon treatments for each
destination: Reports uses a chart, Inventory a box, Spaces stacked layers, POS a
payment card, Sales currency, Products a tag, Branches a building, Merchants a
store, Members users and Overview a home. Routes, labels, active states, role
visibility, collapsed navigation and mobile navigation remain unchanged.

The organization workspace overview now mirrors that navigation as a responsive
flat-card launchpad grouped into Branch operations, Organization and Personal.
It includes every role-allowed sidebar destination plus Account settings, keeps
the role badge in the page header, uses concise card descriptions with compact
spacing, equal-height grid tracks, and a balanced Organization/Personal split,
and preserves the same role visibility and route contracts as the sidebar.

## Dense record-list/table final verification

Parts 1–3 are committed as `a8dddea`, `db1bce9` and `827a3f6`. The final
automated verification passes 787 frontend tests, typecheck, ESLint, production
build and diff validation. The production build reports only the repository’s
pre-existing multiple-lockfile workspace-root warning. Rendered browser review
was not run because no browser surface is connected; responsive, keyboard/focus,
zoom and print behavior are therefore not certified.

## Quietly structured application redesign (corrective pass in review)

All application pages except the public landing page use a Paper work surface,
neutral graphite operational actions and semantic status colors. Organization, branch,
member, merchant, product, inventory and sales views use aligned headings,
filters and records without a card around every section. POS retains a distinct
cart/checkout boundary; Reports retain exact figures, tables and chart plots.
Focused login, registration, invitation and account tasks keep narrow layouts.

After review of three visual references, the open section primitive no longer
draws a rule above and below every instance. Directory lists use a single
structural transition before results and whitespace between rows; charts and
ordinary sections rely more on hierarchy than borders. A selected summary
strip, table header, shell edge, semantic warning or functional container may
still use a line or softly rounded surface. Rounded controls, dialogs and
purposeful inset surfaces remain welcome. No business behavior or landing-page
code changes. Browser-rendered and final accessibility/zoom review remain
pending because no browser surface is connected; automated checks cannot
certify visual layout. Formatting, lint, typecheck, production build and all
787 frontend tests pass for the corrective pass and final automated
verification. The first final standalone typecheck overlapped the build's
regeneration of `.next/types`; its clean sequential rerun and the build's own
TypeScript phase both passed. Rendered desktop/tablet/mobile, keyboard/focus,
dialog, 200% zoom and print-sensitive verification were explicitly waived by
the user on September 19, 2026 because no browser surface was connected.
Automated checks do not certify rendered layout or accessibility.

## Staff sales reports

Owners/managers now have Reports in sidebar/mobile navigation, with both Reports
routes active under that entry rather than Branches. The entry requires explicit
selection from the identity-only authorized Reports branch lookup, even with one
branch. The branch workspace offers a labeled dropdown, inclusive Philippines
From/Through dates and separate Apply/Refresh actions, with no back button.
Dates default to Philippines today independently of browser timezone; validation
is debounced 300 ms per input, immediate on blur and final on Apply with invalid
field focus. Typing does not read, invalid drafts block reads, and the applied
period remains visibly labeled. Date/branch changes and failed/revoked reads clear
old data; scoped guards prevent obsolete responses from restoring totals.

Report Overview leads with net recorded sales after refunds, with gross sales,
refunded amount and completed transactions kept as supporting metrics. The
Overview reading order is summary, primary daily/hourly trend, then grouped
merchant/product and weekday/payment breakdowns. Trend, weekday and payment
visualizations use compact status rows when their series are zero-valued, so an
empty period does not reserve a full chart or imply missing insight. Populated
charts retain their exact accessible values. Operational
cards/payment rows display exact gross recorded sales, transactions and units
without numeric rounding. Strict staff contracts verify branch/range
scope and three-method reconciliation; GCash/card remain explicitly manual and
unverified. Loading, missing assignments, empty periods, failure and denied access
offer safe read/access refresh. Cashiers cannot fetch Reports; merchants use the
separate own-only Reports view, and existing Sales/POS/Inventory is unchanged.
All 532 frontend tests across 75 files, lint/typecheck, changed-source formatting
and production build pass. Rendered Reports responsive/dropdown/date/keyboard/
focus/zoom QA remains pending for final delivery; prior milestone waivers do not
cover these screens. That pending QA was subsequently waived for Reports on
September 14, 2026, as recorded below. See [Sales Reports](reports.md).

The Rankings tab adds metric and merchant controls without changing Overview
totals or charts. Owner/Manager merchant choices are loaded from the existing
role-scoped merchant directory when Rankings is opened; selecting a control
reloads page one and clears stale rows before rendering the matching response.
Merchant accounts receive only the metric control and remain own-product-only.
On tablet, the ranking table keeps product identity, merchant, units/gross, and
net in the primary scan row; SKU/barcode and return/refund details move into
compact product metadata while the full columns remain available on large
screens. The selected sort metric and merchant scope stay visible above the
table, and rank/product columns remain fixed during horizontal metric scrolling.
Merchant-option loading is announced beside its reserved filter width without
blocking the Rank by control.

The applied branch is also shown in a compact sticky Report context bar below
the global workspace header. The tab navigation uses a compact row with modest
top breathing room and a fine active underline, flowing directly into the
content without an extra divider. Report tabs stay at the left and Refresh
Report stays at the right while long chart and table views scroll. On narrow
screens the navigation and refresh action stack in
reading order; the full date editor remains above the bar and is the only
period-editing control.

The Reports context bar also provides a `Transactions` tab. It lazy-loads the
server-paginated completed sale/refund cross-reference for the applied Philippine
date range, with type and debounced receipt/refund-code filters. Staff see saved
merchant, payment and actor context; merchants see only their own amounts and
source references. The table uses the shared operational data-surface pattern,
semantic type pills, a loading skeleton, explicit empty/error/retry states and
previous/next pagination. View links return to the existing authorized sale
detail, where refund actions remain governed by the existing workflow. Stale
responses are discarded when the branch, period, role or filter changes.

## Merchant own-sales reports

Merchant sidebar/mobile navigation now includes Reports alongside unchanged Sales.
The shared branch/date workspace uses a separate strict MERCHANT reader/schema
and own-only cards: Own gross recorded sales, Transactions containing own items
and Own units sold. No whole-sale/payment/actor/contact data, print/export or
mutation controls are fetched/rendered, and staff/private responses fail closed.
Historical branches remain selectable in empty periods; no fallback branch or
profile selector is introduced. Guidance explains assigned versus historical
own-selling access, zero periods and owner-managed links without asserting that
zero sales proves a missing link. Always-available access refresh clears scoped
reads and reloads current grants/link-derived totals; late prior-role/profile/
period responses cannot restore old data.

Final checks pass: 567 frontend tests across 75 files, lint/typecheck, changed-source
formatting and production build, plus all backend regressions. The user explicitly
waived rendered Reports responsive/dropdown/date-input/keyboard/focus/200% zoom QA
on September 14, 2026. Those checks were not performed, and automated tests do not
certify rendered layout/accessibility. This waiver is specific to Reports.

## Inventory navigation refinement

Inventory now appears in sidebar/mobile navigation for owners, managers and
merchants, with inventory directory/detail routes active under this entry rather
than Branches. The organization Inventory entry offers explicit authorized branch
selection; directories/details share a labeled branch dropdown. Normal Back to
branch is removed, while detail-to-inventory and existing shortcuts remain.
Switching branch confirms unsaved form discard and blocks pending writes; scoped
data/filters reset and obsolete reads cannot restore data after access loss.
Cashiers remain denied and merchants retain own-only inventory. No backend or
new-product opening-stock behavior changes in this part. All 443 frontend tests,
lint, type checking, production build and changed-file formatting pass. Rendered QA
was pending at Part 1 delivery and explicitly waived for this milestone on
September 14, 2026. Rendered behavior is not certified by automated checks.

## Optional new-product opening stock

The owner Create product dialog now offers off-by-default Add initial stock with
an explicit tenant branch dropdown, branch PHP selling price and whole-unit
quantity. No branch is silently selected. Enabled submission requires loaded
branches and valid complete stock fields; loading, failure and empty states cannot
fall back to product-only creation. Disabling removes the section and omits stock
input/request ID. Existing-product editing and Add product placement are unchanged.
Aligned shared controls validate each changed field after 300 ms, immediately on
blur and finally on submit, focusing the first invalid control.

One atomic API command saves product and opening inventory. Failed opening saves
freeze the submitted input/request ID for explicit Retry same creation, preventing
duplicate stock after an uncertain response. Pending/recovery locks fields,
dismissal and voluntary link navigation, with document-leaving protection; no
automatic writes or persistent drafts are introduced. Directory filters/scoped
refreshes pause while the dialog is open. Confirmed creation success remains
distinct from failed post-save reads, whose retry cannot write again. All 472
frontend tests across 70 files, lint/typecheck/build and changed-file formatting
pass. The user waived rendered responsive, keyboard/dialog and zoom QA for both
Inventory navigation and this form on September 14, 2026. See [Products](products.md).

## Branch inventory movement records

The Inventory directory now includes a lazy **Movement records** tab inside the
existing branch shell. Staff see it in the order Inventory stock → Movement
records → Stock integrity; merchants see Inventory stock → Movement records.
Opening the tab requests only the selected branch's records. Changing branch,
organization, role or access resets the tab data and ignores obsolete responses.

The panel uses the shared open data-list layout with a leading-icon search field,
a 300 ms debounced query over product name, SKU, barcode and reason, a movement
type dropdown, and a staff-only merchant dropdown. The search field has a compact
label and example placeholder. Optional From and Through inputs are labeled in
Philippine time with calendar icons; Apply requires both dates, validates
`From ≤ Through`, and converts the inclusive local range to a UTC start and
exclusive next-day boundary. Blank dates mean all history. Search and filter
changes reset the cursor to page one.

Rows link the product identity to the selected branch placement detail and show
date/time, type, reason, signed change, balance after and merchant identity.
Owner/manager rows also show the actor name; merchant rows do not render or
accept actor data. Previous/Next controls use opaque filter-bound cursors with
15 records per page. Loading skeletons, unfiltered and filtered empty states,
retryable errors, page-preserving failures, stale-response protection and
responsive/keyboard-accessible controls are included. The existing detail-page
15-row movement history remains unchanged.

The movement filter toolbar uses the surrounding surface rather than a gray
inset. It has no horizontal side padding; at tablet widths the search, movement
type and staff merchant controls share the first row, while the From, Through
and Apply controls stay together, start-aligned and shrink-wrapped on the second
row. Larger desktop widths retain
the single-row arrangement. The date row also provides a Clear dates action, and
movement timestamps are displayed as Philippine-local numeric date/time values
with seconds.

Movement records and placement movement history keep the Reason column last. Each
row uses a compact text-only black View action with a gray pill hover state;
selecting it opens an accessible read-only dialog containing the recorded reason
and an explicit Close action. Visible actor names also use the primary ink text
color. Both movement-history views render the date above the Philippine-local
time and share matching header/row spacing. Tablet layouts use compact columns
with a horizontal-scroll fallback so the final Reason/View cell remains
available. Movement data and role-based visibility remain unchanged.
While either table is loading, its skeleton preserves the same responsive column
structure, row rhythm, and two-line product/date details before real records
arrive.

## POS navigation refinement

Staff sidebar/mobile navigation now includes POS, with branch checkout routes
marking that entry active. The organization POS entry requires explicit authorized
branch selection; branch POS uses the shared labeled dropdown and omits normal
back buttons. Branch switching preserves cancellation, cart-discard confirmation,
scope isolation and pending/uncertain checkout recovery. Merchant navigation remains
read-only Sales. Cart and Sales History are route-backed links in one persistent
branch POS layout/header. Saved receipt detail keeps History active, while normal
POS back buttons and the standalone history shortcut are absent. Same-branch page
changes preserve the cart/payment draft and history dates/pagination; inactive
reads pause, and returning Cart requires fresh authorized branch/catalog reads.
Old staff sales deep links redirect into POS; merchant routes stay separate.
Frozen checkout remains visible rather than being concealed by a History route,
and only the active receipt mounts its print surface.
The user explicitly waived rendered dropdown/tab/responsive/keyboard/dialog/zoom/
print QA for this refinement on September 13, 2026, separately from prior milestone
waivers. Automated checks do not certify rendered behavior or actual printing.

## Product workspace

Product directory/profile screens use the neutral operational panels, controls,
responsive divided rows, filters, status feedback, and owner/manager navigation.
Directory pages use the shared warm-neutral canvas with centered content and flat
rounded collection cards; wide inventory tables use the wider content track while
product, merchant, member, and branch directories keep the tighter track.
Product creation and identity editing use the shared native `FormDialog`: a
focused, scroll-contained surface with browser focus containment, heading focus,
safe pending dismissal, scroll locking, and focus restoration. The default dialog
width is capped at `max-w-3xl`, while explicitly form-sized workflows retain the
more compact `max-w-2xl` treatment. Shared fields align labels and controls before
hints/errors; product validation is debounced on each
input, immediate on blur, and final on submit. Stock mutation lives in the scoped
branch inventory workspace. Expanded automated workflows pass. The user explicitly
waived rendered visual/accessibility QA for these screens on September 12, 2026;
this is a separate waiver from the historical refactor waiver below.

Branch inventory now uses the same operational system for scoped directories,
placement creation, independently priced stock, price/stock controls, and
immutable history. Branch and product details provide owner/manager inventory
links. Placement details follow the reference hierarchy with a context header,
an unlabeled placement summary introduced by one horizontal divider, a structured
movement-history list before the stock workflows, and product-profile navigation
is the fourth placement metric. The summary uses two-row metrics, circular icon
backgrounds, and color-coded current-stock text; receive stock and
low-stock threshold use aligned headings and input/action rows. The detail view uses a compact
back control, tighter header spacing, start-aligned summary cells, and a full-width
divider before movement history. Placement selection uses one searchable
product combobox bounded within the native dialog instead of separate search and
selection inputs. Movement history renders the authenticated actor's display name
for owners and managers; merchant history remains actor-free. Receipt and
correction panels share a responsive two-column row
on suitable viewports and stack on smaller screens. Receive stock asks only for
quantity and records a stable system reason; common reason actions fill the
still-editable required adjustment reason field so manual corrections remain
explainable. Corrections use a custom accessible dropdown, defaulting to the
absolute new-stock-value input, beside the selected input; it shows either that
field or the signed quantity-change field, never both at once. They confirm the
resulting delta and estimated stock through a readable confirmation summary that
includes the product, branch, current stock, method, requested value or change,
net change, and reason while keeping the server authoritative; pending writes
disable repeat/concurrent actions. Stock retry IDs remain unchanged for unchanged
failed commands, and success reloads current inventory instead of treating
historical movement balances as current.
Inventory detail actions now sit beneath movement history as an underlined
Receive, Adjust, Threshold, and Edit price tab strip; Receive is shown by
default, only the selected form is shown at a time, and extra horizontal insets
keep it visually attached to the action row. There is no separate close control;
switching still protects unsaved input.
Movement history requests 15 records at a time and presents Previous and Next
page controls. Changing pages replaces only the movement rows, preserves the
current placement summary, and keeps the current page available when a request
fails so the navigation request can be retried safely. The history list reserves
the space of five desktop rows so a short final page does not cause the panel to
collapse, while wrapped mobile rows can grow naturally.
While an inventory placement is loading, its detail title, description, branch
context, and four summary metrics use an accessible layout-preserving skeleton;
the existing movement-history loading state remains below it and branch
switching stays available.
Owner/manager inventory rows also provide direct Receive stock and Correct stock
dialogs using those same safeguards. Their modal headers show branch and current
unit context as compact upper-right tags instead of body text; merchant rows
remain read-only. Inventory list labels and row content now use a small
horizontal inset while each divider remains full-width. Product
identity continues to link to the full placement and movement-history screen.
Expanded API/component workflows pass alongside regressions (236 frontend tests),
typecheck, lint, formatting, and production build. Test-only native dialog shims
model open/close state, not actual top-layer display or browser focus containment.
No browser is enabled and the user declined enabling one before explicitly
waiving rendered QA. Viewport, zoom, input alignment, modal/menu, keyboard,
contrast, and reduced-motion checks were not performed. Their checklist remains
in the [completed plan](../plans/archive/products-and-branch-inventory-2026-09-12.md).

The add-placement dialog uses the shared narrow form layout, focuses the product
search on open, and separates product selection from branch settings with a
responsive field grouping and action divider. Placement behavior and validation
remain unchanged; rendered browser QA remains pending.

Member management and owner invitation controls use the neutral operational
system on the shared centered canvas and rounded collection surfaces. Invitation
creation uses a native modal with focus restoration and
pending dismissal protection; historical invitation status remains explicit.
Owner access dialogs provide branch grants, confirmed revocations and merchant
relinking, with bounded choices, safe pending dismissal, and request feedback.
Merchant role changes require a profile and explain assignment clearing.
Invitation inputs validate with a 300 ms debounce, immediate blur feedback, and
final submission checks; branch selections and role-dependent merchant choices
are included. Member management makes no directory/invitation requests for
nonowners. These access-control screens have not had rendered browser QA;
the historical visual waivers below do not cover this milestone.
Form dialogs use generous viewport-aware widths. Dialog headings retain initial
focus for context without a visible outline; control focus rings are unchanged.
Submit and action groups in every modal align to the lower right, including
single primary actions and multi-action cancel/submit groups. Existing labels,
pending states, focus behavior, and dismissal safeguards are unchanged.
Merchant workflows now use the shared centered canvas, full-width responsive linked
directory rows, neutral profile panels and shared form controls. Creation uses a compact form-width native dialog with
focus restoration, scroll containment, and pending dismissal protection. Existing
debounced search and validation, role restrictions, and confirmed lifecycle
changes are preserved.

Shared select menus choose upward or downward placement using available viewport
and modal space. Only the choice list scrolls when options exceed that space;
keyboard navigation scrolls the list rather than moving the surrounding modal.

## Guest experiences

Login, registration, and invitation acceptance share a rounded white form
surface on the warm canvas, neutral branding and actions, home navigation, and a
wide-screen editorial context panel. Small screens keep the form first and omit
the optional context panel. Shared fields and notices retain validation,
autocomplete, pending feedback, and first-invalid-field focus. Session
loading/failure states use the same canvas treatment. Authentication redirects
and invitation acceptance contracts are unchanged.

## Public landing page

**Status:** Implemented; approved September 12, 2026

The public `/` route uses an editorial layout with a warm neutral canvas,
graphite actions, responsive feature stories, and registration/sign-in links.
Product illustrations are static HTML/CSS compositions, not live organization
data. They describe existing branch, team, and merchant-profile capabilities.

The neutral wordmark variant is used on public and guest screens. No API,
authorization, tenant, or business behavior changes are introduced.

## Shared design foundations

Signed-in pages offer twelve personal themes: Graphite (default), Ocean, Forest,
Plum, Star Admin, Sypher, Crextio, SBB, and Wellness Teal in the Light group;
Stellar, Corona, and JustDo in the Dark group. Older Pollux, Skydash, Azia,
Purple, Plus Admin, and Breeze preferences remain supported as Ocean or Plum
aliases. The account picker previews each theme from the same CSS token map used by the application.
The selected theme is applied to the document before protected content paints,
including dialogs, menus, and native controls, and is removed on route exit.
Public, sign-in, and invitation pages use Graphite. Account changes preview
immediately, save through the authenticated account endpoint, and roll back on
failure. Printed receipts remain black on white. Palette definitions live in
`frontend/src/app/themes.css`; contrast coverage lives alongside them.

Semantic Tailwind/CSS tokens define the neutral palette, accessible control
outlines, focus, typography, spacing, radii, and floating/overlay elevation.
Feature-specific layouts are migrated in separately reviewed parts. Global focus is neutral
and reduced-motion preferences suppress nonessential transitions and animation.

Public illustrations and navigation now use semantic color/radius tokens and the
shared SVG icon set. Branding is uniformly neutral; the legacy colored variant
has been removed. Global HTML/body defaults use the warm canvas and ink tokens.
Operational panels no longer clip menus, and member controls live in responsive
rows instead of table scrollers. Long panel headings and guest context text wrap.

Shared buttons expose primary, secondary, quiet, and destructive variants.
Pending buttons announce busy state and disable repeat activation. Back links
remain real navigation links. Panels, toolbars, request errors, skeletons, and
status notices use semantic tokens while retaining their existing content and
announcement behavior.

Action buttons and shared dropdown triggers use the same pill-shaped radius as
the inventory filters across authenticated and public pages. Structural tabs,
status tags, and dropdown menu options retain geometry appropriate to their
role.

Text inputs and native date/search controls use the same pill treatment with a
small leading SVG icon selected for the field's meaning, such as account,
calendar, tag, box, mail, or search. Shared `TextField`, `SelectControl`, and
`InputControl` primitives preserve labels, hints, validation, autocomplete,
read-only state, keyboard focus, and native field behavior while removing the
older square control treatment. Checkboxes, radio choices, hidden form inputs,
and popup/list surfaces retain their purpose-specific geometry.

Shared selects retain controlled/uncontrolled values and form submission/reset
behavior, with consistent leading-icon and trailing-chevron insets. Keyboard
users can navigate enabled options with arrows or Home/End,
select with Enter/Space, dismiss with Escape, and leave with Tab. Selection and
dismissal restore trigger focus. Confirmation dialogs initially focus Cancel,
trap Tab within their actions, restore focus and page scrolling on close, and
use unique accessible title/description IDs.

## Authenticated application frame

### Branch and merchant access alignment (Part 7)

Only owners see Members navigation and shared catalog/branch creation controls.
Managers retain assigned-branch editing and inventory controls, with read-only
represented merchant/product views. Merchants receive branch identity, own-profile,
product placement, and inventory/history navigation with no catalog or stock
mutations, branch-wide totals, or movement actors. Cashiers remain branch readers.
Runtime schemas support reduced role responses. Empty/unconfigured states explain
asking an owner. Organization/role/resource changes reset screen state; access
refresh clears branch cache and obsolete responses cannot restore prior data.
Stock/price access-denial responses clear stale placement data and write controls;
successful stock writes still refresh reads without replay on refresh failure.
Automated verification does not certify rendered browser behavior for this milestone.
Final automated checks pass: 266 frontend tests across 52 suites, formatting,
lint, type checking, and production build. The existing multiple-lockfile build
warning remains nonblocking and outside this access-control scope.
The user explicitly waived rendered browser QA for branch/merchant access control
on September 13, 2026. Viewport/zoom, actual modal focus containment, menu layout,
contrast, and rendered reduced-motion checks were not performed for these screens.

Protected routes use a warm neutral canvas and a compact sticky utility header.
The workspace sidebar remains 15.5rem expanded or 4.5rem collapsed and offers
organization switching in both modes. The workspace chrome uses open, borderless
sidebar and top-bar surfaces; navigation uses neutral selected surfaces, borders,
visible labels, and a shared internal outline SVG icon set. Existing
role checks, destination paths, and the skip-to-content link are preserved.
Visible destinations are grouped into Branch operations (POS, Inventory, Sales
and Reports) and Organization (Overview, Branches, Merchants, Products and
Members). Collapsed navigation retains accessible group and destination names.
Branch-scoped operational selectors occupy the PageHeader action area on wider
screens and stack below the title block on narrow screens. Branch-selection
entry routes and their selected-branch workspaces share the same centered wide
content track, so the header does not shift when a branch is chosen.

The mobile navigation drawer uses a native modal dialog for top-layer display,
background interaction blocking, and browser focus containment. It focuses Close
navigation initially, restores the Menu trigger and page scrolling on dismissal,
and closes when the viewport becomes desktop-sized. Header/sidebar/navigation
are hidden for printing; operational feature forms and content layouts retain
their normal workflow semantics.

## Verification status

The inventory workflow and branch workspace usability milestone passes frontend
formatting, lint, type checking, all 751 tests across 88 files and production
build. No backend/database behavior changed. The user explicitly waived rendered
responsive layout, modal/menu, searchable-picker keyboard/focus and 200% zoom QA
on September 15, 2026; those behaviors are not certified by automated tests.

Frontend unit/component tests, type checking, linting, formatting of changed
sources, production compilation, and a legacy-style source scan are checked after
each part. This does not certify rendered accessibility or responsive layout.
No enabled browser surface was available for final visual QA. Viewport review at
320/768/1024/1440 pixels, 200% zoom, rendered contrast, and visual reduced-motion
verification were not run. The user explicitly waived browser-based QA on
September 12, 2026. Automated checks passed (149 tests, typecheck, lint,
changed-source formatting, production build, and diff checks); this does not
certify rendered accessibility or responsive behavior. The implementation plan
is archived with that limitation recorded.

## Organization and account workflows

Organization selection/creation, workspace overview, and account profile/password/
deletion use shared neutral page headers, borderless card surfaces, fields,
actions, and feedback.
The Account Settings route uses a centered compact `OperationalPage` composition
with anchored Profile, Appearance and Security navigation. Each top-level section
uses one rounded borderless card surface, and the navigation exposes a live selected
indicator with a dark bottom rule as the page scrolls between sections. Personal information
uses a responsive two-column form where the sign-in email is visibly read-only;
the save action and feedback remain attached to that form. Appearance choices are
grouped into compact Light and Dark preview tiles with a visible selected state.
The optional phone field accepts common Philippine mobile and telephone formats,
including local and `+63` forms, and blocks invalid values before the profile
request is sent.
Password fields use shared pill inputs with opt-in show/hide controls and retain
their existing client validation, loading, success and error feedback; the
visibility controls use accessible icon-only actions. Security
contains the password form and a separate Danger zone; account deletion collects
the existing password contract inside an accessible confirmation modal, keeping
the password field out of the resting page.
Password validation feedback sits below the affected control so paired password
inputs remain aligned while errors are visible. Password success feedback only
appears after the change request resolves; the existing sign-out behavior is
preserved.
Shared fields connect labels, hints, existing described-by content, and errors to
their input; native autocomplete, readonly values, and validation constraints are
preserved. Invalid submissions focus the first invalid control.

Organization selection uses one divided content surface, while the workspace
overview groups destinations into responsive rounded borderless section cards. The
overview exposes only implemented workflows and preserves role-aware visibility.
Account deletion retains password validation and an explicit modal confirmation
with solid danger styling only at final confirmation.
No backend, tenancy, API, or session behavior changes are introduced.

Resting button/input borders use light stone outlines while keyboard focus remains
strong. Organization selection and overview rows own their internal padding, so
their hover surface extends to both edges of the content panel.

## Branch workflow

Branch directory/detail/create/edit use the neutral shared controls and panels.
The directory uses the shared warm-neutral canvas, a centered rounded borderless
collection card, and full-width responsive rows instead of a wide fixed-minimum table. The
create/edit form lives in a focused feature-owned component and uses
a native modal with scroll containment, pending-write protection, focus
restoration, and safe dismissal. Shared fields support opt-in hints above inputs
to preserve the branch form's established field layout; other fields retain hints
below by default. Branch search/filter behavior, API requests, normalization,
authorization, tenant scoping, and optional-field clearing are unchanged.
Branch create/edit dialogs use the shared form-dialog shell with grouped identity,
address, and location sections, responsive two-column fields, and a normal-flow
action footer that never obscures long-form fields.
Field feedback updates after a short typing debounce and is rechecked immediately
on blur and submit through the existing branch schema.
The form-level error notice stays hidden during editing and appears compactly
beside the action buttons only after a submit attempt.

Branch detail now shares the same full-page canvas and centered wide frame as the
directory. A sticky accessible tab strip separates the branch overview,
authorized inventory, POS, sales, participation, and spaces workspaces. Only the
selected panel renders, while the tab underline, horizontal narrow-screen
overflow, keyboard movement, padded branch information, status/edit actions,
inventory-health feedback, and role-aware behavior remain consistent with the
existing design system. Status changes use the shared accessible confirmation
dialog before the existing status request runs.

## Branch POS cart delivery

Branch POS uses the existing warm-stone operational panels, consistent text fields
and shared native dialogs. It offers exact-code Enter addition, bounded debounced
search, explicit ambiguous-product choice and quantity feedback on input (300 ms)
and blur. The cart is memory-only, with exact PHP estimates. Role-aware entry
points and branch/org scope clearing preserve
the backend's authorization boundaries. Outgoing links and organization-menu
navigation warn before discarding a cart; history navigation clears on unmount.
Rendered POS browser QA was explicitly waived for this milestone on September 13,
2026, including responsive, keyboard/dialog, zoom and print checks.

The organization POS entry and branch checkout routes now share the warm-neutral
canvas and centered wide workspace frame used by the other operational pages.
Checkout panels, branch selection, route-backed Cart and Sales History tabs, cart
guards, and full-screen mode are preserved.

## POS cashier workflow and tablet layout

The Cart tab now prioritizes rapid barcode/SKU entry and keeps the existing
scanner, exact lookup, repeated-scan quantity and focus-restoration behavior.
Product rows are reduced to product name, merchant, SKU, price, stock and a
compact Add action. iPad landscape uses a two-column product/cart workspace; the
cart is viewport-bounded with a stationary heading and checkout footer and an
independently scrolling item list. Quantity steppers use 44-pixel touch targets
and preserve the existing input, stock and payment validation.

Narrow/portrait layouts show products in one column and keep a sticky cart count,
total and Review payment action. View cart opens a focus-managed native bottom
sheet. Optional in-app full-screen mode hides the authenticated header and
organization navigation, leaves branch/history/exit controls in a compact POS
toolbar, and ends when leaving the Cart route. It is not persisted and does not
invoke browser fullscreen. The existing color, typography, neutral action and
fine-border tokens are reused; no API, database or checkout business logic
changed.

The POS/workspace/shell focused suite passes 128 tests; frontend lint, typecheck
and production build pass. The full frontend run is 854/857 because three tests
in the separately modified Inventory movement and Sales workflow UI still expect
their previous accessible labels (“From (PH)” and “Search receipt code”). Those
pre-existing unrelated edits were preserved. Rendered tablet/portrait browser
review was unavailable because no browser surface was connected, so automated
layout tests do not certify final rendered dimensions.

## POS payment and completion

The shared native payment dialog presents a reviewed cart, cash tender/exact change
estimate or explicitly manual/unverified GCash/card reference. Field validation
runs after 300 ms on input, on blur and on submit; received-payment confirmation
is required. Pending and uncertain writes block unsafe edits/dismissal and new
checkout. Focused organization/user-keyed memory retains the frozen unresolved
command across route changes for identical-ID recovery; it is not an offline draft.
Price conflicts require another review, stock/lifecycle failures require correction,
and successful completion clears the cart and renders persisted receipt snapshots.
Catalog refresh and printing failures retry reads/printing only. Print CSS exposes
only the internal receipt, not workspace controls or private retry data. Browser
responsive/dialog/zoom/print QA was explicitly waived for this milestone on
September 13, 2026, without inheriting a prior milestone's waiver.

## Sales history and own-sale views

Staff branch sales lists/details use divided warm-stone panels, bounded pagination
and validated half-open UTC filters. They render saved transaction names/amounts,
not live catalog replacements. Detail refresh and internal printing retry only
reads/printing. Merchants receive a Sales navigation/overview entry with historical
identity-only selling branches, then reduced own-item lists/details labeled Own
items subtotal. Their views have no cashier/payment/whole-total data, print or
checkout controls. Separate strict runtime contracts reject stale-role full receipt
responses instead of falling back to staff data. Scope changes unmount old read
state; loading/error/empty states and read-only access refresh preserve isolation.
The new September 13, 2026 waiver covers these POS/sales screens; automated checks
do not certify rendered accessibility or printing.

Sales history, receipt detail, and own-selling-branch pages now share the same
warm-neutral canvas and centered wide frame used by inventory. Their collection
and receipt surfaces use the shared rounded borderless treatment, while embedded
POS history remains inside the existing POS shell.

Saved receipt detail uses a clear identity header, structured purchased-item rows,
and a payment summary with the completed total visually separated from supporting
payment metadata. Staff refund controls separate returnable quantities from
recorded refund history, with the return action and estimated refund amount placed
near the context they affect. The Return refunds section follows the saved receipt
with a subtle divider, and its total count remains quiet left-aligned metadata in
the same row as pagination. The saved receipt's
internal print action is kept at the end of the receipt content as a colored primary
action. These are presentation and workflow-clarity changes;
receipt snapshots, refund APIs, authorization, pending-attempt recovery and
printing behavior remain unchanged.

## Merchant branch participation

Merchant and branch detail pages use the shared paginated association section. Owner
assignment/status controls use native dialogs and confirmations; managers and
merchants see scoped read-only associations. Member/invitation dialogs remove
merchant branch grants and explain inherited profile access. Inventory and POS
show inactive participation and disable receiving/selling; corrections and history
remain available. Opening stock and placement choices require active affiliations.
See [Merchant–branch relationships](merchant-branches.md).

## Branch space occupancy

Branch details and merchant profiles now include the optional space workflow
specified in [Branch space occupancy](spaces.md). It uses the existing flat
operational rows, native dialogs, and role-scoped read-only views. Lifecycle and
participation confirmations explain automatic release with an advisory occupied
space count; successful status changes refresh occupancy. No new visual system or
product/inventory/sales placement requirement is introduced.

## Spaces workspace (October 10, 2026)

Branch operations includes Spaces after Inventory for owners, managers, and
merchants. The organization entry `/app/organizations/[organizationId]/spaces`
and direct branch route
`/app/organizations/[organizationId]/branches/[branchId]/spaces` share authorized
branch selection and the existing workspace's remembered branch. The direct URL
wins; unavailable remembered choices require an explicit accessible selection.
Cashiers have no entry or Spaces data requests, including on direct visits.

The page follows the existing operational layout and reuses the branch Spaces
component and forms. Space details use a dedicated operational page. Owners manage, managers view assigned branches,
and merchants view only their own spaces/history. Staff can filter occupied or
vacant spaces with server pagination; merchants cannot browse vacancy. Existing
branch-detail and merchant-profile entry points are preserved. Branch switching
honors POS/refund guards, confirms dirty form discard, and is disabled during
pending space writes. Branch access and space reads show responsive skeletons
that mirror the eventual controls and rows; error, empty, unavailable, and
retry states remain explicit. See [spaces](spaces.md) for API and privacy
semantics.

The Spaces section header keeps its title and description in one left-aligned
block with the owner action button in the same horizontal row; it wraps the
button below the copy on narrow screens.

Spaces workspace and detail routes use the shared gray canvas, centered wide
content, and rounded white panels for lists, types, overview, actions, and
occupancy history. Existing branch selection, dirty-state protection, and role
visibility are preserved.

### Spaces and Types tabs

Owners/managers receive Spaces and Types tabs in the dedicated Spaces workspace.
Spaces remains branch-scoped; Types manages the organization's shared vocabulary
without branch selection. Owners add types, managers view/search them, and
merchants retain only their scoped Spaces view. Creation/edit and type filters
use catalog choices. Space forms give the space name a full first row and keep
the type dropdown and Create a new type action together on the second row.
Blank space names and blank new-type names show compact live errors beside their
labels after interaction. Choosing that action replaces the dropdown with a
new-type input, Save type, and Discard controls aligned with the input; a short
organization-wide description sits below it. No expanded section is added below.
The draft is preserved and the new type is selected after success; it persists
even if the space is cancelled.
The create/edit dialog focuses the space name, uses a compact responsive details
layout with field-level guidance, protects dirty
drafts on dismissal, and gives loading failures an explicit retry path. Tabs
support arrow/Home/End keyboard navigation and prevent discarding
dirty drafts or switching during pending writes without the existing safeguards.
The tab switcher uses the same flat underline treatment as Inventory. The Spaces
view uses the shared open data-list geometry with dedicated Space, Type, Status,
Occupancy, and Actions columns. The list defaults to Active spaces. Status and
occupancy values use compact success/danger pills, and the flexible Space column
keeps the action group anchored at the far end of each row. Owner row actions are
limited to Assign, Archive, and View, with Archive using the danger text
treatment and disabled while occupied. View opens a focused detail page with
a space overview, current occupancy, paginated history, branch navigation, and
owner-only assignment, edit, release, and status actions; managers and merchants
remain read-only. The history list labels Merchant, From date, Until date, and
Released by columns. The history table spans the page below the overview/actions area and provides merchant
search plus optional From date and Until date filters; empty dates show all history.
History displays the occupancy interval dates only, without a time component, and does not expose separate
record-creation or record-update timestamps.
Assignment and release forms use date-only controls; the modal keeps merchant
and space selection together and places historical start/end dates in one
responsive row. The completed past occupancy option uses a custom accessible
switch with a clear on/off state instead of the browser-default checkbox.
Occupied, vacant, and archived states use distinct semantic treatments, while the
action group stays on one desktop row.
Its search control is a leading-icon pill sized wider than the type, status, and
occupancy selectors. Types presents a separated create/catalog layout with
shared-catalog labeling for scanability.
