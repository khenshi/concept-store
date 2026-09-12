# Frontend Experience

## Public landing page

**Status:** Implemented; approved September 12, 2026

The public `/` route uses an editorial layout with a warm neutral canvas,
graphite actions, responsive feature stories, and registration/sign-in links.
Product illustrations are static HTML/CSS compositions, not live organization
data. They describe existing branch, team, and merchant-profile capabilities.

The neutral wordmark variant is opt-in; guest screens retain their previous
branding until their migration is approved. No API,
authorization, tenant, or business behavior changes are introduced.

## Shared design foundations

Semantic Tailwind/CSS tokens define the neutral palette, accessible control
outlines, focus, typography, spacing, radii, and floating/overlay elevation.
Feature-specific layouts are migrated in separately reviewed parts. Global focus is neutral
and reduced-motion preferences suppress nonessential transitions and animation.

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
are hidden for printing; operational feature forms and content layouts remain for
later approved parts.

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
