# Frontend Experience

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
Product creation and identity editing use the shared native `FormDialog`: a wide,
scroll-contained surface with browser focus containment, heading focus, safe
pending dismissal, scroll locking, and focus restoration. Shared fields align
labels and controls before hints/errors; product validation is debounced on each
input, immediate on blur, and final on submit. Stock mutation lives in the scoped
branch inventory workspace. Expanded automated workflows pass. The user explicitly
waived rendered visual/accessibility QA for these screens on September 12, 2026;
this is a separate waiver from the historical refactor waiver below.

Branch inventory now uses the same operational system for scoped directories,
placement creation, independently priced stock, separate price/receipt/correction
forms, and immutable history. Branch and product details provide owner/manager
inventory links. Placement selection is searchable and bounded within the native
dialog. Corrections confirm the signed delta and estimated stock while keeping
the server authoritative; pending writes disable repeat/concurrent actions. Stock
retry IDs remain unchanged for unchanged failed commands, and success reloads
current inventory instead of treating historical movement balances as current.
Expanded API/component workflows pass alongside regressions (236 frontend tests),
typecheck, lint, formatting, and production build. Test-only native dialog shims
model open/close state, not actual top-layer display or browser focus containment.
No browser is enabled and the user declined enabling one before explicitly
waiving rendered QA. Viewport, zoom, input alignment, modal/menu, keyboard,
contrast, and reduced-motion checks were not performed. Their checklist remains
in the [completed plan](../plans/archive/products-and-branch-inventory-2026-09-12.md).

Member management and owner invitation controls use the neutral operational
system. Invitation creation uses a native modal with focus restoration and
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
Merchant workflows now use full-width responsive linked directory rows, neutral
profile panels and shared form controls. Creation uses a wide native dialog with
focus restoration, scroll containment, and pending dismissal protection. Existing
debounced search and validation, role restrictions, and confirmed lifecycle
changes are preserved.

Shared select menus choose upward or downward placement using available viewport
and modal space. Only the choice list scrolls when options exceed that space;
keyboard navigation scrolls the list rather than moving the surrounding modal.

## Guest experiences

Login, registration, and invitation acceptance share a paper form surface on the
warm canvas, neutral branding and actions, home navigation, and a wide-screen
editorial context panel. Small screens keep the form first and omit the optional
context panel. Shared fields and notices retain validation, autocomplete, pending
feedback, and first-invalid-field focus. Session loading/failure states also use
the neutral system. Authentication redirects and invitation acceptance contracts
are unchanged.

## Public landing page

**Status:** Implemented; approved September 12, 2026

The public `/` route uses an editorial layout with a warm neutral canvas,
graphite actions, responsive feature stories, and registration/sign-in links.
Product illustrations are static HTML/CSS compositions, not live organization
data. They describe existing branch, team, and merchant-profile capabilities.

The neutral wordmark variant is used on public and guest screens. No API,
authorization, tenant, or business behavior changes are introduced.

## Shared design foundations

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

Shared selects retain controlled/uncontrolled values and form submission/reset
behavior. Keyboard users can navigate enabled options with arrows or Home/End,
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
organization switching in both modes. Navigation uses neutral selected surfaces,
borders, visible labels, and a shared internal outline SVG icon set. Existing
role checks, destination paths, and the skip-to-content link are preserved.

The mobile navigation drawer uses a native modal dialog for top-layer display,
background interaction blocking, and browser focus containment. It focuses Close
navigation initially, restores the Menu trigger and page scrolling on dismissal,
and closes when the viewport becomes desktop-sized. Header/sidebar/navigation
are hidden for printing; operational feature forms and content layouts retain
their normal workflow semantics.

## Verification status

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
deletion use shared neutral page headers, panels, fields, actions, and feedback.
Shared fields connect labels, hints, existing described-by content, and errors to
their input; native autocomplete, readonly values, and validation constraints are
preserved. Invalid submissions focus the first invalid control.

Organization rows and overview destinations use one divided content surface rather
than stacked floating cards. The overview exposes only implemented workflows and
preserves role-aware visibility. Account deletion retains password validation and
an explicit confirmation with solid danger styling only at final confirmation.
No backend, tenancy, API, or session behavior changes are introduced.

Resting button/input borders use light stone outlines while keyboard focus remains
strong. Organization selection and overview rows own their internal padding, so
their hover surface extends to both edges of the content panel.

## Branch workflow

Branch directory/detail/create/edit use the neutral shared controls and panels.
The directory uses full-width responsive rows instead of a wide fixed-minimum
table. The create/edit form lives in a focused feature-owned component and uses
a native modal with scroll containment, pending-write protection, focus
restoration, and safe dismissal. Shared fields support opt-in hints above inputs
to preserve the branch form's established field layout; other fields retain hints
below by default. Branch search/filter behavior, API requests, normalization,
authorization, tenant scoping, and optional-field clearing are unchanged.

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
