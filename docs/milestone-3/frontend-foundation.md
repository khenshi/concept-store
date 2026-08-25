# Milestone 3: Frontend Application Foundation

## Scope

This part refines the authenticated frontend foundation before adding Milestone 3 feature screens. It gives every protected route one consistent Tailwind application shell and improves the shared header and organization navigation.

It does not add spaces, assignments, agreements, new API clients, backend changes, or Milestone 4 functionality.

## Tailwind styling convention

Frontend presentation follows this ownership rule:

```text
Document-wide defaults and design tokens → globals.css
Repeated interface patterns             → React components with Tailwind
Feature and page presentation           → Tailwind utilities in that feature
```

Repeated styles do not automatically belong in `globals.css`. Buttons, cards, fields, navigation, alerts, and page headers should become reusable React components when reuse is meaningful. Page-specific selectors should not be added globally.

`globals.css` remains intentionally small and contains only the Tailwind import and document-level base behavior.

## Authenticated shell

The protected route-group layout now owns:

- the minimum-height application background
- the shared authenticated header
- consistent responsive horizontal and vertical page spacing
- a common maximum content width
- authentication gating around the entire shell

Individual route pages now render only their feature component. This prevents new authenticated pages from accidentally omitting the header or using inconsistent outer spacing.

## Header and navigation

The authenticated header now provides:

- the shared brand wordmark linked to the workspace selector
- a workspace navigation cue
- the signed-in email on wider screens
- a restrained sign-out action
- a sticky white surface with a subtle border
- responsive spacing aligned with the content container

Organization tabs now support horizontal overflow on narrow screens and use consistent hover and active states.

## Design alignment

The foundation follows the approved modern, minimal, clean, and trustworthy B2B direction:

- neutral slate page surfaces
- white operational navigation surface
- emerald reserved for brand and active states
- subtle borders and shadows
- no gradients, decorative animation, or unnecessary color
- responsive layout without hiding required actions

## Validation

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
```
