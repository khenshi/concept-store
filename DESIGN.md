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
  control-border: "#D8D8D2"
  graphite-action: "#242422"
  graphite-hover: "#3A3A37"
  operational-accent: "#242422"
  operational-accent-hover: "#3A3A37"
  operational-accent-soft: "#ECECE7"
  selected-surface: "#ECECE7"
  selected-border: "#A8A8A0"
  focus-ring: "#575752"
  success: "#168A52"
  success-ink: "#117447"
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

The application-page redesign keeps the public landing page unchanged. Other
pages use open, well-aligned compositions inspired by the supplied references:
paper planes, whitespace and typographic hierarchy replace most repeated card
frames. Dividers mark major transitions, not every section and row. Focused
login, invitation and account flows keep their narrow task layouts rather than
inheriting the workspace sidebar.

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

### Monochrome operational foundation

For now, operational actions, active navigation, chooser badges and data
visualization use the graphite/neutral scale. The accent token is intentionally
an alias of Graphite Action so shared components stay consistent without
introducing blue. Reserve green for success/healthy state, amber for caution/low
stock, and red for errors/destructive/out-of-stock state; these are semantic
feedback colors, not decorative branding. Labels, icons and structure must also
communicate the meaning. The public landing page keeps its existing graphite
action treatment.

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
- **Control Border** (`#D8D8D2`): quiet resting button/input outlines. Hover may
  strengthen to Selected Border; keyboard focus remains high-contrast Focus Ring.
- **Graphite Action** (`#242422`) and **Graphite Hover** (`#3A3A37`): primary
  public and operational actions.
- **Operational Accent** (`#242422`) and hover (`#3A3A37`): a neutral alias of
  Graphite Action for selected application actions and navigation, with a soft
  neutral tint (`#ECECE7`) for small supporting cues. White text on the accent
  meets AA.
- **Selected Surface** (`#ECECE7`) and **Selected Border** (`#A8A8A0`): active
  navigation, selected rows, filters, and low-emphasis state.
- **Focus Ring** (`#575752`): keyboard focus paired with a separating Paper or
  Warm Canvas outer ring.
- **Success** (`#168A52`), **Warning** (`#8A4B10`), and **Danger** (`#C53B37`):
  named outcomes that also use text, icons, or structure. Use the darker
  **Success Ink** (`#117447`) for normal-size success text on Paper.

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
- Application content rests on an open Paper plane beside the divided sidebar.
  Ordinary sections use vertical rhythm, alignment and type rather than a
  repeated frame or top-and-bottom rule. Use a few hairlines for structural
  transitions, such as shell edges, a table header or a summary strip.
  Functional cart/table/chart boundaries may retain a contained surface when
  it improves comprehension.

### Focused mode

Authentication, invitations, and narrow account tasks use a 28–34rem column. A
quiet context panel may balance wide screens without fictional functionality.

Narrow layouts collapse in DOM/task order; meaning never relies on position.

## Shape, borders, and elevation

- Compact statuses/icons: `0.5rem`; inputs/buttons: `0.625rem`; focused dialogs
  and functional inset surfaces may use `0.875rem`; public feature surfaces:
  up to `1.5rem`. Rounded corners are welcome on purposeful interactive or
  contained surfaces; ordinary sections need not be boxed at all.
- Pills are for short statuses, filters, and tags—not every action.
- Resting surfaces use a one-pixel Hairline border and no shadow.
- Menus/popovers may use the floating shadow; dialogs may use overlay shadow.
- Form dialogs use nearly the full viewport width on phones and a generous
  56–64rem maximum width on larger screens, with contained vertical scrolling.
  Programmatically focused dialog headings do not display an outline; interactive
  controls retain visible keyboard focus rings.
- Avoid thick borders, bubbly card stacks, glow, glassmorphism, and excessive nested
  rounding.

## Components

### Actions

- Public primary: Ink background, Paper text, 2.75rem visual height.
- Operational primary: Graphite Action or the single Operational Accent when
  action hierarchy benefits from color, Paper text, 2.625rem visual height with
  a 44-pixel minimum touch target. Do not color every button.
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

- Ordinary operational sections use open Paper, spacing and type hierarchy with
  no resting shadow. A top or bottom Hairline is reserved for a real structural
  change, not applied automatically to every section.
- Headers use concise titles, quiet descriptions, and one aligned action area.
- Toolbars use Paper or a restrained Soft Surface; let control grouping and
  placement do most of the work before adding a divider.
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

- Prefer a clear list/table header and well-aligned, comfortably spaced rows
  instead of a card per record or a rule between every row. Hover and selected
  states can use a quiet tint. Keep row rules only when density or comparison
  makes them useful.
- Dense directories use one lightly contained data surface with a compact,
  uppercase-muted column header, aligned record rows and a clear trailing
  target/action. Use the shared `data-surface`, `data-column-header` and
  `data-row` styles when the collection is implemented as a responsive list.
- Keep a consistent 1.5rem column rhythm between labels, values and trailing
  actions across comparable list/table rows; action groups may use tighter
  internal spacing only when their controls are visually grouped.
- Keep related identity metadata—such as name with email, code, SKU or
  timestamp—in one bounded identity column. Split only values that need their
  own comparison or action alignment.
- Keep the surface background and surrounding page canvas in the same warm-stone
  family. The surface owns its modest rounding; records do not become individual
  cards. On narrow screens, hide nonessential column labels and let each record
  stack with readable metadata rather than compressing columns.
- Strengthen record identity; render metadata smaller in Quiet Ink.
- Align columns for scanning and use tabular figures for numbers.
- Status badges include text and, where useful, a small icon.
- Convert non-comparative phone rows to labeled stacks; true tables use a contained
  horizontal scroller with headers.

### Collection and chooser pages

- Organization/workspace pickers may use a calm, responsive grid of lightly
  contained cards when each item is a meaningful destination. Keep the page
  background and card surfaces unified; use whitespace, a compact search/action
  row and consistent card geometry for rhythm.
- A chooser card may be gently rounded and bordered for click affordance. Keep
  its content limited to verified identity, role/access context and navigation;
  do not add decorative metrics or fictional activity data.

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
keeping tools compact; use one action accent and semantic colors purposefully;
prefer dividers and alignment to shadow; let store content provide most visual
color; preview only implemented capabilities.

**Do not:** copy reference brands, assets, metrics, or claims; add gradients, glass,
glow, or ubiquitous shadows; add decorative brand colors; turn every item into a card
or pill; hide essential labels; or show affordances for unimplemented features.
