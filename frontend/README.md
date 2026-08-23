# Concept Store Frontend

Shared Next.js web application for the Concept Store Management System. Store operators and merchants will use separate role-based areas within this application.

The current code contains only the frontend foundation. Authentication screens and API integration are not implemented yet.

## Requirements

- Node.js 20.9 or newer
- Running Concept Store backend for future integration

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_URL` to the backend origin.
3. Install dependencies with `npm install`.
4. Start development with `npm run dev`.

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Structure

```text
src/
  app/          Next.js App Router routes and layouts
  config/       Validated frontend environment configuration
```

Feature directories will be introduced only as their Milestone 1 vertical slices are implemented.
