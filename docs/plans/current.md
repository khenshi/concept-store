# Frontend Design-System and Experience Refactor Plan

**Status:** Approved; implementation in progress in separately reviewed parts

**Date:** September 12, 2026

## Part-by-part review checkpoints

- Part 1: Public landing page approved and committed as `5b3f014`.
- Part 2: Semantic foundations and existing shared UI primitives approved and
  committed as `3a84d9f`.
  Feature-specific form and layout migration remains in subsequent parts.
- Part 3: Authenticated header, sidebar, organization switching, and navigation
  approved and committed as `84a8628`, including the switcher second-click fix.
- Part 4: Organization selection/creation, workspace overview, and account
  profile/password/deletion approved and committed as `ff8bf91`, including lighter
  control borders and full-width organization-row hover surfaces.
- Part 5: Branch directory, creation, detail, and editing approved and committed
  as `51f264b`.
- Part 6: Member management and owner invitation workflows approved and committed
  as `40395bd`, including wider form dialogs and outline-free focused headings.
- Part 7: Merchant directory, profile, editing, and lifecycle workflows approved.
  Shared dropdown refinement bounds menus to modal space, opens upward when
  needed, and confines option scrolling to the menu.
- Part 8: Login, registration, invitation acceptance, and guest/session states next.
- Subsequent parts: Operational features, guest experiences, and final cross-route
  verification.

Each part stops for user approval before its commit and before starting the next
part. No part may expand the feature scope or change backend behavior.

## Goal

Refactor every existing frontend surface into one coherent system based on the
supplied references. The direction is **editorial operational minimalism**: a
warm, nearly monochrome canvas; confident oversized type on public pages;
compact, information-dense workspace screens; fine borders; softly layered
surfaces; restrained curves; and small, deliberate accents.

This changes presentation, layout, component composition, responsive behavior,
and interaction polish. It preserves implemented business behavior, API
contracts, authorization, tenant isolation, and validation.

## Reference interpretation

The images share a design language rather than one exact template:

- warm white and light-gray canvases with near-black typography;
- generous editorial whitespace and tightly tracked marketing headlines;
- compact dashboard chrome with a sidebar and slim utility header;
- thin neutral borders and tonal separation instead of heavy shadows;
- white or softly tinted cards with restrained rounding;
- graphite calls to action and quiet tonal selection states that remain compatible
  with different categories of concept store;
- small outline icons, quiet metadata, and scannable operational density; and
- responsive compositions that retain hierarchy rather than simply stacking.

Kapwesto will adapt these qualities without copying the sample brands, phone
mockup, financial charts, pricing, or unimplemented features.

## Scope

### Foundations and shared components

- Implement the tokens and rules in `DESIGN.md` as semantic CSS custom properties
  in `frontend/src/app/globals.css`.
- Define canvas, surfaces, text, borders, accents, status colors, radii, spacing,
  control heights, shadows, typography, focus, and motion.
- Continue using Inter through `next/font`; add no display-font dependency.
- Consolidate shared buttons/links, fields, selects, field messages, badges,
  panels, toolbars, list/data rows, empty/error/loading states, dialogs, page
  headers, back links, and status notices with semantic variants.
- Replace duplicated feature-level visual class strings where a shared primitive
  should own the rule, while keeping shared code domain-agnostic.
- Preserve semantics, labels, keyboard behavior, focus management, pending and
  disabled states, and relevant test hooks.

### Public, guest, and invitation experiences

- Recompose the home page as a spacious editorial page with compact navigation,
  oversized value proposition, concise copy, and clear registration/sign-in
  actions.
- Replace generic foundation cards with alternating feature stories and HTML/CSS
  product previews based only on implemented organizations, branches, teams,
  invitations, and merchant profiles.
- Add a restrained closing action and footer; do not imply analytics, inventory,
  sales, billing, reporting, or other unavailable capabilities.
- Introduce a shared guest shell for login, registration, and invitation acceptance
  with a focused form and optional quiet context panel at wide viewports.
- Standardize credential forms, validation summaries, success/error feedback,
  pending states, and cross-links without changing auth or invitation behavior.

### Authenticated application shell

- Refactor the header and organization shell into compact application chrome: a
  persistent desktop sidebar, slim utility header, bordered content canvas, and
  deliberate maximum widths.
- Clarify brand, organization switching, grouped navigation, account access,
  logout, and sidebar-collapse hierarchy.
- Replace interface text glyphs with a small internal SVG icon set. Do not add an
  icon dependency unless the plan is amended with a concrete need.
- Preserve role-aware destinations, route matching, `aria-current`, print behavior,
  and stored sidebar preference.
- Provide a proper mobile menu with focus handling, dismissal, scroll containment,
  and no inaccessible hidden content.

### Operational pages and complete feature coverage

- Standardize page anatomy: breadcrumb/context, title and supporting copy, primary
  action, optional filters, content surface, and request feedback.
- Use compact controls and rows while retaining 44-by-44 CSS-pixel primary touch
  targets. Use tables only when column comparison is important; otherwise use
  semantic responsive lists.
- Align loading, empty, error, success, and unavailable states without masking their
  behavioral differences.
- Apply the system to organization entry/creation/selection/switching and overview;
  branch list/create/detail/edit; member list/invitations/role/removal; merchant
  list/search/filter/create/detail/edit/status; account profile/password/deletion;
  and all existing modal, confirmation, and request states.
- No existing route may remain on the previous visual language.

### Responsive and accessibility requirements

- Define phone, tablet, laptop, and wide-desktop behavior for public, form, list,
  detail, modal, and shell layouts.
- Maintain logical DOM/task order, landmarks, headings, explicit labels,
  descriptive actions, keyboard access, focus visibility, and live announcements.
- Meet WCAG 2.2 AA contrast; state must never depend on color alone.
- Respect `prefers-reduced-motion`; motion remains short and functional.
- Avoid page overflow at 320 CSS pixels except contained data scrollers.

## Explicit exclusions

- Backend, Prisma, API, authorization, tenant, or validation changes.
- New modules or routes: dashboards, analytics, revenue, orders, inventory,
  products, transactions, goals, marketing, sales, payments, billing, plans, AI,
  reports, or exports.
- Search, notification, chart, customization, or export controls copied from the
  reference dashboard unless they already have implemented behavior.
- Pricing claims, reference-brand assets, phone photography, stock imagery, or
  unimplemented product previews.
- Dark mode, user themes, tenant branding, charting packages, third-party component
  libraries, and broad state-management/routing/API rewrites.

Exclusions must not produce placeholders, disabled navigation, mock metrics,
unused abstractions, or speculative dependencies.

## Architecture rules

- Route modules remain thin; feature composition stays within feature components.
- Shared primitives expose semantic variants and never import business features.
- Prefer CSS/Tailwind and internal SVG for deterministic visuals. A new runtime
  dependency requires explicit justification and a plan amendment.
- Preserve request, authorization, validation, accessible-name, and focus behavior.
- Migrate complete workflows rather than leaving mixed old/new interfaces.

## Testing and visual verification

- Update component tests for navigation, mobile menu behavior, dialogs, focus,
  pending states, validation, request feedback, and role-aware visibility.
- Preserve coverage for every implemented workflow; adjust assertions only where
  user-visible wording or semantics intentionally change.
- Run frontend formatting, linting, type checking, unit tests, and production build.
- Render and inspect every route and meaningful state at 320, 768, 1024, and 1440
  CSS pixels.
- Verify keyboard traversal, dialog focus/restoration, 200% zoom, reduced motion,
  long names/emails, empty/populated lists, errors, and pending submissions.
- Check overflow, clipping, layout shifts, contrast, stale styles, and
  role-inappropriate navigation.

## Implementation sequence

1. Inventory rendered routes, state variants, class duplication, and tests; record
   a visual baseline.
2. Add semantic tokens and global foundations, then shared primitives and focused
   accessibility tests.
3. Refactor the authenticated header, sidebar, switcher, navigation, mobile menu,
   and operational page anatomy.
4. Migrate organization entry/overview and account workflows to validate shell,
   form, panel, and destructive-action patterns.
5. Migrate branches, members/invitations, and merchants one complete workflow at a
   time, including all request states.
6. Rebuild login, registration, and invitation guest experiences.
7. Recompose the landing page using only implemented capabilities.
8. Remove superseded styling and duplication; complete automated, responsive,
   accessibility, and visual checks.
9. Update affected `docs/modules/*.md` frontend sections where behavior/navigation
   changed; archive this plan only after all acceptance criteria pass.

## Acceptance criteria

- Every current route uses the new language with no legacy component islands.
- Public/guest pages use spacious editorial density; authenticated pages use compact
  operational density; both are recognizably Kapwesto.
- All workflows and role-based visibility work without backend or API changes.
- Shared primitives cover recurring controls/states without erasing necessary
  feature behavior.
- Viewport and accessibility checks pass under the stated conditions.
- Format, lint, typecheck, tests, and production build pass.
- Module documentation reflects delivered interaction or navigation changes.
- No excluded or unimplemented capability appears in code or product copy.

## Approval boundary

The user approved implementation on September 12, 2026, with a mandatory review
checkpoint before committing each part and starting the next part.
