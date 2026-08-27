# Unified Dropdowns and Confirmations

## Scope

This change replaces inconsistent browser-native dropdown presentation and `window.confirm` prompts throughout the authenticated Milestones 1–4 frontend. It changes interaction presentation only and preserves all existing form submissions, mutations, validation, authorization, and business rules.

## Dropdown control

`SelectControl` provides one reusable Concept Store dropdown with:

- consistent emerald/slate trigger and option styling
- a custom option surface instead of the operating system's select popup
- selected-option indication
- disabled-option and disabled-control states
- click-outside and Escape dismissal
- combobox/listbox semantics
- hidden form values so existing `FormData` submission remains compatible
- controlled and uncontrolled modes for filters and live page state
- form-reset synchronization

The shared control is used by Product, Inventory, Movement History, Merchant, Agreement, Space, Assignment, and Member workflows.

## Confirmation dialog

`useConfirmationDialog` provides one shared accessible confirmation surface with:

- explicit action title and consequence description
- safe Cancel focus on opening
- Escape cancellation
- primary and destructive confirmation treatments
- alert-dialog semantics

It replaces native confirmation prompts for:

- ending a merchant
- activating or ending an agreement
- ending a space assignment
- removing an organization member

Historical-retention and lifecycle behavior remain unchanged.

## Validation

- Component coverage for selecting/submitting a dropdown value
- Component coverage for confirming an action
- Prettier formatting
- TypeScript checking
- ESLint
- Frontend test suite
- Next.js production build
