# React site pages

Every route except `/charts/`. Vite + React + wouter + Tailwind, shadcn-style primitives in `client/src/components/ui/`.

## Before editing

- Trace the route in `client/src/App.tsx` → page file → inline JSX. Pages define their own sections and stale `*-legacy.tsx` or same-named components exist; a matching filename is not proof it renders (pitfall, 2026-06-23).
- Read `DESIGN.md` for intent and `client/src/index.css` for tokens. Use beam tokens and existing utility classes; no new hues, gradient text, glass cards or per-widget CRT effects.
- `PRODUCT.md` governs every number and label: basis named, simulated fills labelled, no account-dollar P&L.

## Account and auth

- Better Auth, email + password only (`server/auth.ts`, client helpers in `client/src/lib/auth-client`: `useSession`, `signIn`, `signUp`, `signOut`). Browsing never requires an account.
- `/account` (`client/src/pages/account.tsx`) holds sign in, sign up (`?mode=signup`), verification notice and ToS acceptance. `GET /api/me` returns `{user:null}` signed out and `{user, tosAccepted, tosVersion}` signed in.
- State-changing calls use `csrfFetch` (`client/src/lib/csrf-fetch.ts`).
- The navbar (`client/src/components/navbar.tsx`) links `account`; it has five links at most and one status tier (`DESIGN.md`).
- A return-to parameter on `/account` must accept only same-origin relative paths and default to `/account` when invalid.

## Motion

One section animates at a time (`client/src/lib/beam-scheduler.ts`). Pause off-screen and when the document is hidden. No `prefers-reduced-motion` branch (owner decision, 2026-08-02). Canvas and WebGL checks run in headed Chrome per `CLAUDE.md`.

## Verification

`npm run check`, `npm test`, `npm run build`. Start `web-dev` from `.claude/launch.json` (port 5000). FearLab data routes return 503 locally and pages fall back to the bundled snapshot; auth needs `DATABASE_URL` and auth secrets, so signed-in flows are unverified locally unless the user supplies them.
