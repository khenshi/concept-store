# Milestone 1: Account Profile Settings

## Scope

This part adds a personal Account Settings page for authenticated users. It allows a user to view and update the personal details shared across their organization memberships.

Included fields:

- first name
- last name
- optional phone number
- read-only sign-in email

Password changes, email changes, session management, account deletion, and organization deletion are intentionally separate parts.

## API

`PATCH /auth/me` requires a valid access token and updates only the authenticated user derived from that token.

Request:

```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "phone": "+63 917 123 4567"
}
```

Sending an omitted or blank phone number clears the saved phone number. Names are trimmed and must contain 1–80 characters. Phone numbers are limited to 25 characters.

The response uses the existing authenticated-user shape and never includes password or session data.

## Frontend behavior

- `/app/account` contains the profile form.
- Selecting the signed-in user's name in the authenticated header opens Account Settings.
- A successful update immediately refreshes the shared authenticated-user state, including the header name.
- The email is displayed as read-only because changing login identity requires a separate verification and security workflow.

## Security

- The client cannot select which user to update.
- The backend derives the user ID from the verified access token.
- Organization roles do not affect access because every authenticated user owns their personal profile.
