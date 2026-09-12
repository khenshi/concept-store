# Frontend Experience

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
