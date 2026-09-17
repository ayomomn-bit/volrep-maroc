# volrep-admin

Operational admin dashboard for the VOLREP store. A **separate** Next.js
app (port 3001) — the public storefront (`volrep-maroc`) is never touched.

## Architecture

```
volrep-admin (browser, :3001)
      │  fetch(..., { credentials: "include" })   — httpOnly session cookie only
      ▼
volrep-backend Fastify API (:4000)  /api/admin/*
      ▼
PostgreSQL
```

- **No secrets in the browser.** No `x-internal-api-key`, no bearer token,
  no DB credentials. The only credential is the backend's httpOnly
  `volrep_admin_session` cookie, which JavaScript can never read. The
  backend rejects `x-internal-api-key` on every `/api/admin/*` route.
- The only config is `NEXT_PUBLIC_ADMIN_API_URL` (the backend base URL —
  not sensitive).
- Backend CORS must allow this origin with credentials
  (`CORS_ADMIN_ORIGIN`, already `http://localhost:3001` in dev).

## Setup

```bash
npm install
cp .env.example .env.local          # NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4000
npm run dev                          # http://localhost:3001

# create the first admin (in the volrep-backend repo):
#   npm run admin:create -- --email you@volrep.com --role owner
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on :3001 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest — pure-logic unit tests (`lib/`) |

## Structure

```
app/
  login/page.tsx            public
  (app)/layout.tsx          protected shell (auth gate + sidebar + top bar)
  (app)/page.tsx            dashboard
  (app)/orders, orders/[id]
  (app)/products, products/new, products/[id]
  (app)/inventory, reviews, shipping, audit-log
lib/
  api.ts                    the single backend client (credentials: include)
  auth.tsx                  <AuthProvider> — GET /me, global 401 -> /login
  hooks.ts                  useResource / useMutation
  rbac.ts                   UI capability gates (backend is authoritative)
components/
  ui.tsx, Sidebar, TopBar, orders/*, products/*
```

## Roles

`owner` sees/does everything. `staff` is gated in the UI (no product
create, no publish/unpublish, shipping read-only) **and** by the backend —
hiding a control is only an affordance, never the authorization boundary.
