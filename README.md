# Harborline Band — Team Portal & Public Site

Production source for [harborlineband.com](https://harborlineband.com) and the team portal at `/team/*`.

**Owner:** Josh Miller — `joshjmiller-MGMT` on GitHub.
**Hosting:** Netlify project `harborline-official`.
**Backend:** Supabase project `mbqyznttpvebahgygsbx` (`harborline-team`).

## Stack

Vite 5 · React 18.3 · TypeScript 5.8 · Tailwind 3.4 · shadcn/ui · Radix · react-router-dom v7 · @tanstack/react-query · react-helmet-async · framer-motion · lucide-react. Supabase JS for backend.

## Quick start

```sh
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
npx tsc --noEmit
```

## Source-of-truth docs

The authoritative spec for stack, routes, conventions, and constraints is `../PROJECT_INSTRUCTIONS_v3.md` in the parent `Harborline Website/` working tree. **Read it before non-trivial changes.** It overrides any older `CLAUDE.md` files inside this repo.

For business/intent context (who Josh is, brand voice, plays in flight, decisions), see `../co-manager/CLAUDE.md`.

## Deploy

Netlify auto-deploys on push to `main` (Netlify→GitHub link is live as of 2026-04). The legacy manual zip-upload path is no longer needed.

## Layout

- `src/pages/` — public site pages (incl. `services/`, `ensembles/`, `locations/`, `venues/`).
- `src/pages/team/` — authenticated team portal.
- `src/components/` — shared UI; `src/components/dashboard/` for portal widgets.
- `src/integrations/supabase/` — generated types + client.
- `supabase/functions/` — edge functions (Google OAuth, availability checker, posting-times, social-ai, Monday/DJEP integrations).
- `supabase/migrations/` — schema migrations, applied via Supabase MCP `apply_migration`.

## Standing rules

- No Lovable. The Lovable AI gateway is decommissioned; AI work uses the direct Anthropic API.
- Don't touch GoDaddy DNS or Netlify domain settings without explicit ask.
- The `harborline-live` GitHub repo (archived) and Netlify project are kept around as a rollback path — don't delete.
