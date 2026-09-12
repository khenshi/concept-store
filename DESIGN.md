---
name: Kapwesto
description: Editorial calm for the public story; compact clarity for daily store operations.
direction: Editorial Operational Minimalism
colors:
  warm-canvas: "#F4F4F1"
  paper: "#FFFFFF"
  soft-surface: "#F8F8F6"
  ink: "#171717"
  quiet-ink: "#6F706D"
  faint-ink: "#9A9B97"
  hairline: "#E7E7E2"
  strong-hairline: "#D8D8D2"
  control-border: "#898A84"
  graphite-action: "#242422"
  graphite-hover: "#3A3A37"
  selected-surface: "#ECECE7"
  selected-border: "#A8A8A0"
  focus-ring: "#575752"
  success: "#168A52"
  warning: "#8A4B10"
  danger: "#C53B37"
typography:
  family: "Inter, ui-sans-serif, system-ui, sans-serif"
  display:
    {
      fontSize: "clamp(3rem, 7.5vw, 6.75rem)",
      fontWeight: 500,
      lineHeight: 0.94,
      letterSpacing: "-0.065em",
    }
  section-heading:
    {
      fontSize: "clamp(2.25rem, 5vw, 4.75rem)",
      fontWeight: 500,
      lineHeight: 0.98,
      letterSpacing: "-0.055em",
    }
  page-title:
    {
      fontSize: "clamp(1.65rem, 3vw, 2.25rem)",
      fontWeight: 600,
      lineHeight: 1.08,
      letterSpacing: "-0.035em",
    }
  panel-title: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.3 }
  body: { fontSize: "0.9375rem", fontWeight: 400, lineHeight: 1.6 }
  label: { fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.35 }
rounded:
  {
    compact: "0.5rem",
    control: "0.625rem",
    surface: "0.875rem",
    feature: "1.5rem",
    pill: "999px",
  }
shadow:
  floating: "0 10px 30px rgb(23 23 23 / 0.08)"
  overlay: "0 24px 70px rgb(23 23 23 / 0.14)"
---

# Design System: Kapwesto

## Creative direction

**North Star: “The Quietly Confident Storefront.”**

Kapwesto uses **editorial operational minimalism**. Public pages are spacious,
assured, and product-led: large typographic statements, warm whitespace,
quiet brand moments, and interface previews instead of decorative clutter. Authenticated
screens are tighter and utilitarian: compact navigation, aligned controls, fine
dividers, calm data surfaces, and tonal contrast that clarifies action and state.

Both modes share type, neutral palette, geometry, borders, and voice. They differ
in density, not identity.

## Core principles

### Warm neutrality

Use Warm Canvas around Paper and Soft Surface layers. White is a content surface,
not every area's default. Ink is nearly black rather than blue slate. Quiet text is
secondary but must retain accessible contrast.

### Neutral emphasis

Graphite, weight, contrast, and position establish emphasis. Primary actions use
Graphite Action; hover uses Graphite Hover. Selected items use Selected Surface and
Selected Border with stronger text and an additional structural cue. This neutral
foundation lets each concept store's products and photography supply visual color
without forcing Kapwesto into a fashion, food, beauty, or lifestyle palette.

### Designed density

Marketing compositions breathe. Work surfaces compress related information and
controls without becoming cramped. Density follows task context.

### Quiet structure

Use alignment, whitespace, tonal changes, and one-pixel borders before elevation.
Static cards do not receive shadows merely because they are important.

## Color system

- **Warm Canvas** (`#F4F4F1`): outer page and application canvas.
- **Paper** (`#FFFFFF`): content, controls, sidebar, and dialogs.
- **Soft Surface** (`#F8F8F6`): inset zones and alternating sections.
- **Ink** (`#171717`): headings, copy, and dark public actions.
- **Quiet Ink** (`#6F706D`): descriptions and metadata.
- **Faint Ink** (`#9A9B97`): placeholders and nonessential decoration only.
- **Hairline** (`#E7E7E2`) and **Strong Hairline** (`#D8D8D2`): dividers,
  surfaces, and decorative boundaries.
- **Control Border** (`#898A84`): meaningful control boundaries, strengthened for
  non-text contrast on light surfaces.
- **Graphite Action** (`#242422`) and **Graphite Hover** (`#3A3A37`): primary
  public and operational actions.
- **Selected Surface** (`#ECECE7`) and **Selected Border** (`#A8A8A0`): active
  navigation, selected rows, filters, and low-emphasis state.
- **Focus Ring** (`#575752`): keyboard focus paired with a separating Paper or
  Warm Canvas outer ring.
- **Success** (`#168A52`), **Warning** (`#8A4B10`), and **Danger** (`#C53B37`):
  named outcomes that also use text, icons, or structure.

Do not use gradients. Translate the references' soft variation into stable solid
tints rather than glass effects.

## Typography

Use Inter everywhere. Editorial character comes from scale, medium weight, tight
tracking, and measured line length—not another display font.

- **Display:** 500, `clamp(3rem, 7.5vw, 6.75rem)`, 0.94 line height,
  `-0.065em` tracking; public hero only.
- **Section heading:** 500, `clamp(2.25rem, 5vw, 4.75rem)`, 0.98 line height.
- **Page title:** 600, `clamp(1.65rem, 3vw, 2.25rem)`, 1.08 line height.
- **Panel title:** 600, `1rem`, 1.3 line height.
- **Body:** 400, `0.9375rem`, 1.6 line height.
- **Label:** 600, `0.8125rem`, 1.35 line height.
- **Metadata:** 400–500, `0.75rem` to `0.8125rem`.

Use sentence case and deliberate display line breaks. Avoid gratuitous uppercase,
extra-bold text, and long centered paragraphs. Public prose stays near 55–65
characters per line; operational prose near 65–75.

## Layout modes

### Public editorial mode

- Maximum width approximately 80rem with fluid 1.25–5rem gutters.
- Heroes use generous space and asymmetric copy/product-preview composition.
- Feature stories alternate text and real interface previews inside large Soft
  Surface regions. Decoration never exists merely to fill a grid cell.
- Major sections use 5–9rem vertical space on desktop and 3.5–5rem on phones.

### Operational mode

- A Paper sidebar and utility header frame a Warm Canvas content area.
- Sidebar is approximately 15–16rem expanded and 4.5rem collapsed.
- Content may grow to approximately 90rem with 1.25–2.5rem responsive gutters.
- Headers, toolbars, and panels align to one grid; filters and rows remain compact.

### Focused mode

Authentication, invitations, and narrow account tasks use a 28–34rem column. A
quiet context panel may balance wide screens without fictional functionality.

Narrow layouts collapse in DOM/task order; meaning never relies on position.

## Shape, borders, and elevation

- Compact statuses/icons: `0.5rem`; inputs/buttons: `0.625rem`; operational panels:
  `0.875rem`; public feature surfaces: up to `1.5rem`.
- Pills are for short statuses, filters, and tags—not every action.
- Resting surfaces use a one-pixel Hairline border and no shadow.
- Menus/popovers may use the floating shadow; dialogs may use overlay shadow.
- Avoid thick borders, bubbly card stacks, glow, glassmorphism, and excessive nested
  rounding.

## Components

### Actions

- Public primary: Ink background, Paper text, 2.75rem visual height.
- Operational primary: Graphite Action, Paper text, 2.625rem visual height with a
  44-pixel minimum touch target.
- Secondary: Paper, Ink, Control Border. Quiet actions use transparent or
  Soft Surface. Destructive actions become solid Danger only in final confirmation.
- Hover shifts tone modestly. Focus must remain visible on Paper and Warm Canvas.
  Disabled and pending states explain why the action cannot proceed.
- Use clear verbs. Underline inline links; button-shaped actions need no underline.

### Fields

- Paper fill, Control Border, Ink text, `0.625rem` radius, 2.75rem minimum
  visual height, persistent label, and linked hint/error.
- Focus strengthens the border and adds a visible ring. Error uses Danger plus text.
- Search may use a leading outline icon and compact toolbar height.

### Panels and public features

- Operational panels use Paper, Hairline, `0.875rem`, and no resting shadow.
- Headers use concise titles, quiet descriptions, and one aligned action area.
- Toolbars use Soft Surface or Paper with a divider, not a card around each filter.
- Public feature cards may use `1.5rem` and broad whitespace; previews stay quieter
  than their headline.

### Navigation

- Group short labels under quiet section captions where useful.
- Active items use Selected Surface, Ink text, Selected Border, an outline icon, and
  `aria-current`; never only a colored line.
- The utility header supports context/account actions, not duplicate navigation.
- Mobile navigation is a disclosed/off-canvas region with focus and dismissal.
- Icons use a consistent 1.75–2px rounded outline and remain secondary to labels.

### Lists and tables

- Prefer one bordered surface with divided rows instead of a card per record.
- Strengthen record identity; render metadata smaller in Quiet Ink.
- Align columns for scanning and use tabular figures for numbers.
- Status badges include text and, where useful, a small icon.
- Convert non-comparative phone rows to labeled stacks; true tables use a contained
  horizontal scroller with headers.

### Dialogs, menus, and feedback

- Floating UI is the main place shadows are allowed.
- Dialogs require title/description, predictable actions, scroll containment,
  initial focus, focus trapping, safe Escape dismissal, and focus restoration.
- Menus align with triggers and work equally with keyboard and pointer.
- Skeletons mirror final geometry. Empty states explain the absence and offer one
  authorized action. Errors explain retry safely. Success names the outcome and
  uses live-region semantics.

## Motion

Use 120–180ms ease-out transitions for color, border, opacity, and small menu
movement. Do not animate routine content into view. Remove nonessential motion under
`prefers-reduced-motion: reduce`.

## Content voice

Copy is direct, calm, and specific for owners, managers, cashiers, and merchants in
the Philippines. Headings describe tasks/outcomes and buttons use verbs. Avoid vague
dashboard jargon, inflated claims, and language implying unavailable features.

## Accessibility requirements

- Meet WCAG 2.2 AA contrast and interaction requirements.
- Keep primary touch targets at least 44 by 44 CSS pixels where practical.
- Preserve landmarks, heading hierarchy, logical task order, and visible focus.
- Never depend on color, placement, hover, or iconography alone.
- Support keyboard-only use, 200% zoom, reduced motion, long content, and 320-pixel
  viewports.

## Do and do not

**Do:** use warm neutral space and near-black type; let public type breathe while
keeping tools compact; use graphite and tonal contrast for emphasis; prefer borders
and alignment to shadow; let store content provide color; preview only implemented
capabilities.

**Do not:** copy reference brands, assets, metrics, or claims; add gradients, glass,
glow, or ubiquitous shadows; add decorative brand colors; turn every item into a card
or pill; hide essential labels; or show affordances for unimplemented features.
