---
name: Concept Store Management System
description: A clear, trustworthy operational system for concept stores and their merchants.
colors:
  operational-emerald: "#059669"
  deep-emerald: "#047857"
  mist-emerald: "#D1FAE5"
  signal-amber: "#F59E0B"
  cloud-slate: "#F8FAFC"
  clear-white: "#FFFFFF"
  ink-slate: "#0F172A"
  quiet-slate: "#64748B"
  hairline-slate: "#E2E8F0"
  success-green: "#16A34A"
  alert-red: "#DC2626"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
rounded:
  alert: "0.5rem"
  control: "0.6rem"
  action: "0.65rem"
  surface: "0.75rem"
  pill: "999px"
spacing:
  xs: "0.45rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "1.5rem"
  2xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.operational-emerald}"
    textColor: "{colors.clear-white}"
    rounded: "{rounded.action}"
    padding: "0.75rem 1.1rem"
    height: "2.8rem"
  button-primary-hover:
    backgroundColor: "{colors.deep-emerald}"
    textColor: "{colors.clear-white}"
    rounded: "{rounded.action}"
    padding: "0.75rem 1.1rem"
  button-secondary:
    backgroundColor: "{colors.clear-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.control}"
    padding: "0.65rem 0.9rem"
    height: "2.6rem"
  input:
    backgroundColor: "{colors.clear-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.control}"
    padding: "0.7rem 0.8rem"
    height: "2.9rem"
  card:
    backgroundColor: "{colors.clear-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.surface}"
    padding: "1.5rem"
  count-badge:
    backgroundColor: "{colors.mist-emerald}"
    textColor: "{colors.deep-emerald}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.45rem"
  success-status:
    backgroundColor: "{colors.clear-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.alert}"
    padding: "0.75rem 1rem"
---

# Design System: Concept Store Management System

## Overview

**Creative North Star: "The Clear Store Ledger"**

The interface should feel like a well-kept operational record: calm enough to support long working sessions, precise enough for inventory and financial workflows, and trustworthy enough for owners and merchants to act without hesitation. Brand expression comes from disciplined hierarchy, crisp emerald actions, and consistent information structure rather than decoration.

The system uses comfortable operational density. It gives forms and decisions enough breathing room to remain legible while avoiding the expansive pacing of a marketing site. Role-specific experiences may change information architecture, but they must remain recognizably part of the same clear system.

**Key Characteristics:**

- Calm, precise, and trustworthy
- Clear hierarchy with comfortable operational density
- Emerald actions on neutral slate and white surfaces
- Flat structure defined by borders rather than decoration
- Consistent patterns optimized for clarity, usability, and speed

## Colors

The palette uses green as a focused operational signal while cool neutral surfaces carry most of every screen.

### Primary

- **Operational Emerald** (`#059669`): Primary actions and the strongest interactive emphasis.
- **Deep Emerald** (`#047857`): Hover states, text links, and small high-contrast brand labels.
- **Mist Emerald** (`#D1FAE5`): Focus outlines and low-emphasis selected or counted states.

### Secondary

- **Signal Amber** (`#F59E0B`): Warning and attention states only; it is not a decorative companion color.

### Neutral

- **Cloud Slate** (`#F8FAFC`): Page background and the quiet outer canvas.
- **Clear White** (`#FFFFFF`): Cards, controls, and primary content surfaces.
- **Ink Slate** (`#0F172A`): Headings and primary body text.
- **Quiet Slate** (`#64748B`): Supporting copy, metadata, and secondary information.
- **Hairline Slate** (`#E2E8F0`): Borders, dividers, and structural separation.

### Status

- **Success Green** (`#16A34A`): Confirmed successful outcomes.
- **Alert Red** (`#DC2626`): Validation failures and destructive or blocking error states.

### Named Rules

**The Focused Green Rule.** Operational Emerald identifies actions and meaningful state; most of the interface remains neutral.

**The Semantic Amber Rule.** Signal Amber is reserved for warnings and attention, never general decoration.

## Typography

**Display Font:** Inter with a sans-serif fallback  
**Body Font:** Inter with a sans-serif fallback

**Character:** Clear, compact, and confident. A single type family keeps operational screens coherent; scale, weight, spacing, and case establish hierarchy.

### Hierarchy

- **Display** (700, `clamp(2.5rem, 7vw, 4.5rem)`, 1.05): Public-page statements and rare top-level moments.
- **Headline** (700, `clamp(2rem, 6vw, 3rem)`, 1.05): Authentication, workspace, and major task headings.
- **Title** (700, `1rem`): Panel and card headings.
- **Body** (400, `1rem`, 1.6): Instructions, descriptions, and operational content; keep prose lines near 65–75 characters when practical.
- **Label** (700, `0.9rem`): Form labels and compact action language.
- **Eyebrow** (700, `0.75rem`, `0.12em`, uppercase): Short context labels only, rendered in Deep Emerald.

### Named Rules

**The One-Family Rule.** Use Inter throughout; hierarchy comes from disciplined scale and weight, not additional font families.

**The Short-Eyebrow Rule.** Uppercase eyebrows orient the user in a few words and never carry sentences.

## Layout

The public surface centers a content region up to 60rem wide. Authenticated workspaces use a wider 64rem content region beneath a restrained header, while authentication forms use a focused 29rem card. Page gutters respond between 1.25rem and 4rem.

Operational panels use a two-column grid when the secondary action benefits from staying visible: the primary region receives roughly five-eighths of the width and the supporting region three-eighths. At 40rem and below, multi-column areas collapse into a single column without changing task order.

Spacing follows a comfortable rhythm built around 0.75rem, 1rem, 1.25rem, 1.5rem, and 2.5rem steps. Related controls stay close; panel boundaries create the larger pauses.

**The Task-Order Rule.** Responsive layouts collapse in reading and task order; mobile must never require visual position to explain sequence.

## Elevation & Depth

The system is flat and structured. It uses solid surface color, one-pixel Hairline Slate borders, spacing, and hierarchy to establish depth. Resting cards and controls have no shadows. Overlays may introduce restrained elevation only when a future interaction genuinely occupies a layer above the page.

**The Flat-by-Default Rule.** A surface earns elevation through behavior, not importance; static cards remain flat.

## Shapes

Corners are gently rounded and functional. Alerts use a compact 0.5rem radius, inputs and secondary controls use 0.6rem, primary actions use 0.65rem, and cards use 0.75rem. Count badges use a full pill shape. Thin borders define controls and surfaces without adding visual weight.

**The Contained-Curve Rule.** Radii communicate grouping and interaction; avoid oversized, playful rounding on operational surfaces.

## Components

### Buttons

- **Shape:** Gently rounded action shape (`0.65rem`) with a minimum 2.8rem primary height.
- **Primary:** Operational Emerald with Clear White text, bold label, and `0.75rem 1.1rem` padding.
- **Hover / Focus:** Hover shifts to Deep Emerald. Keyboard focus uses a three-pixel Mist Emerald outline with a two-pixel offset.
- **Secondary:** Clear White surface, Ink Slate text, Hairline Slate border, and a slightly tighter `0.6rem` radius.
- **Disabled:** Preserve the component color while reducing opacity; pending actions communicate progress in their label.

### Cards / Containers

- **Corner Style:** Restrained surface curve (`0.75rem`).
- **Background:** Clear White on Cloud Slate.
- **Shadow Strategy:** No resting shadow.
- **Border:** One-pixel Hairline Slate.
- **Internal Padding:** Usually 1.5rem, increasing only for focused authentication surfaces.

### Inputs / Fields

- **Style:** Clear White fill, Hairline Slate border, Ink Slate text, `0.6rem` radius, and a minimum 2.9rem height.
- **Focus:** Three-pixel Mist Emerald outline with a two-pixel offset.
- **Error:** Alert Red border and connected error text; form-level errors use a bordered white alert rather than a tinted decorative panel.
- **Disabled:** Reduced opacity and a clear pending cursor only during active submission.

### Navigation

- **Style:** The wordmark is a bold Inter text link rather than a separate decorative typeface. Authenticated headers align the product link and account action at opposite edges.
- **Links:** Deep Emerald, bold, underlined when presented as text actions, with a visible focus outline.
- **Organization Tabs:** Use a single Hairline Slate baseline with compact bold labels. The active page uses Ink Slate text and a two-pixel Operational Emerald underline, reinforced semantically with `aria-current="page"`; inactive tabs remain Quiet Slate.
- **Mobile:** Preserve direct access to the product home and session action without introducing hidden navigation until route volume requires it.

### Count Badges

- **Style:** Mist Emerald pill with Deep Emerald text, compact padding, and a bold 0.75rem count.
- **Use:** Quantitative context such as organization counts; not a general decorative tag.

### Selectable List Items

- **Style:** Full-width white button rows with Hairline Slate borders, a `0.6rem` radius, strong primary text, and Quiet Slate metadata.
- **State:** Hover changes only the border to Operational Emerald, maintaining a calm surface.

### Operational List Rows

- **Style:** Within a bordered panel, separate records with one-pixel Hairline Slate dividers instead of nesting each row in another card. Use strong primary text, Quiet Slate metadata, and compact neutral code tags.
- **Actions:** Keep one short text action aligned opposite the record summary. Use Deep Emerald, bold weight, and an underline so the affordance does not depend on color.
- **Empty State:** Center a concise heading and role-aware explanation inside the same panel; do not introduce illustration or extra decoration for routine empty data.

### Success Status

- **Style:** Confirm completed operations in a Clear White message with a one-pixel Success Green border, Ink Slate text, `0.5rem` radius, and `0.75rem 1rem` padding.
- **Behavior:** Announce the message with status semantics and use explicit outcome copy that names the affected record. Success color supports the message but never replaces its text.

### Form Groups

- **Layout:** Group closely related fields into two-column rows while keeping every field explicitly labeled. Use an asymmetric split when one value is predictably shorter, such as a branch code beside a branch name.
- **Hints and Errors:** Place optional guidance directly with its field in Quiet Slate. Connect field errors to invalid controls, provide a form-level review message, and move focus to the first invalid field after validation.
- **Responsive:** At the single-column breakpoint, collapse grouped fields to one column in DOM and task order. When edit mode changes the form context, move focus to the form heading.

## Do's and Don'ts

### Do:

- **Do** use solid white surfaces and Hairline Slate borders to organize operational content.
- **Do** reserve Operational Emerald for primary actions and meaningful interactive state.
- **Do** keep form labels explicit, validation messages adjacent, and keyboard focus unmistakable.
- **Do** preserve comfortable density and collapse responsive grids in task order.
- **Do** use plain, direct English appropriate for owners, managers, cashiers, and merchants in the Philippines.

### Don't:

- **Don't** introduce gradients, glassmorphism, translucent panels, or decorative shadows.
- **Don't** add colors, fonts, icon libraries, or interaction patterns without a clear product requirement.
- **Don't** use Signal Amber as decoration or a second brand color.
- **Don't** rely on color alone to communicate status, role, validation, or authorization.
- **Don't** add unnecessary animation to operational workflows.
