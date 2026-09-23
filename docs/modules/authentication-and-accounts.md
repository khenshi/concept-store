# Authentication and Accounts

**Status:** Implemented

## Responsibilities

- Account registration and login.
- Authenticated identity retrieval.
- Profile editing.
- Password changes.
- Account deletion.
- Personal signed-in color theme selection.
- Access-token issuance and refresh-session rotation.

## API

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
PATCH  /auth/me
PATCH  /auth/me/theme
POST   /auth/change-password
DELETE /auth/me
```

## Rules

- Passwords are hashed with bcrypt.
- Authentication failures avoid account enumeration.
- Access tokens are short lived.
- Refresh tokens rotate, are stored hashed, and are transported in HTTP-only
  cookies.
- Password changes revoke all refresh sessions.
- Account deletion requires the current password, revokes access, removes active
  memberships, and anonymizes credentials.
- A sole organization owner cannot delete their account.
- Authentication-sensitive routes use dedicated rate limits.
- Authenticated users can select Graphite, Ocean, Forest, Plum, Star Admin,
  Sypher, Crextio, SBB, Wellness Teal, Stellar Dark, Corona Dark, or JustDo
  Dark. Older Pollux, Skydash, Azia, Purple, Plus Admin, and Breeze preferences
  continue to work and resolve to the nearest retained palette. The theme is
  personal to the account and is returned by registration, login, refresh,
  `GET /auth/me`, and profile/theme updates. Unknown theme values are rejected.

## Data

`User` stores account identity and credentials. `UserSession` stores hashed,
expiring, revocable refresh sessions and is deleted with its user.
`User.colorTheme` stores the selected palette, defaulting to `GRAPHITE` for
existing and new accounts. The theme endpoint updates only the authenticated
user's record.

## Frontend

The frontend provides registration, login, authenticated route protection,
logout, profile editing, password changing, and account deletion workflows.

Authenticated routes share a compact neutral utility header with a workspace
home link, Philippine Standard Time on wide screens, account access at every
viewport size, and a sign-out action that announces pending state and prevents
repeat activation. Authentication/session contracts are unchanged.

Login and registration share a neutral guest shell with a focused form, home
navigation, and a quiet contextual panel on wide screens. Shared labeled inputs
retain autocomplete and validation rules. Invalid submissions focus the first
invalid field; pending submissions are announced and prevent repeat activation.
Local invitation return paths, authenticated guest redirects, and safe fallback
navigation are preserved. Session loading and failure states use the neutral
visual system.

Account settings use shared neutral panels, explicit labeled fields, and consistent
error/success notices. Invalid submissions focus the first invalid field and never
reach the API. Pending actions prevent repeated submission. Email stays read-only;
profile normalization, password validation, and session invalidation are unchanged.

Account settings also offers an accessible radio group for complete light color
themes. Selecting a palette previews it immediately on signed-in pages, saves it
to the account, and restores the saved choice if the request fails. The
selection applies across devices and organization memberships. Public and
sign-in pages retain the Graphite brand palette.

Account deletion requires the current password and a separate destructive
confirmation. The form's initial action is outlined rather than solid red. Cancel
does not call the API and restores focus; server rejections, including sole-owner
restrictions, are shown without changing the backend's authorization rules.
