# Frontend Experience

## Public landing page

**Status:** Implemented; approved September 12, 2026

The public `/` route uses an editorial layout with a warm neutral canvas,
graphite actions, responsive feature stories, and registration/sign-in links.
Product illustrations are static HTML/CSS compositions, not live organization
data. They describe existing branch, team, and merchant-profile capabilities.

The neutral wordmark variant is opt-in; existing authenticated and guest screens
retain their previous branding until their migration is approved. No API,
authorization, tenant, or business behavior changes are introduced.

## Shared design foundations

Semantic Tailwind/CSS tokens define the neutral palette, accessible control
boundaries, focus, typography, spacing, radii, and floating/overlay elevation.
Existing feature-specific layouts are not yet migrated. Global focus is neutral
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
