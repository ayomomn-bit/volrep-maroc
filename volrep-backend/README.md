# volrep-backend

Self-owned backend for VOLREP, replacing Shopify per the "Volrep Backend
Architecture" document (Phase 2). See that document for full design
rationale — this README covers setup and current status only.

## Stack

Fastify · TypeScript · PostgreSQL · Drizzle ORM · Zod · argon2id

## Prerequisites

- Node.js ≥ 20.6 (uses `--env-file` and native `--watch`)
- PostgreSQL 16 running locally (or reachable via `DATABASE_URL`)

## Setup

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and INTERNAL_API_KEY
npm run db:migrate        # applies drizzle/*.sql to the database in .env
npm run dev                # starts the API on http://localhost:4000
```

Generate a real `INTERNAL_API_KEY` with `openssl rand -hex 32` — this is
the shared secret the Next.js frontend sends on every server-to-server
call.

**Deploying to production?** See [`DEPLOYMENT.md`](DEPLOYMENT.md) — the
backend binds loopback and sits behind Nginx/Caddy, remote PostgreSQL must
use TLS, and production requires real (≥ 32-char, non-placeholder) values
for `INTERNAL_API_KEY`, `LIRYA_API_KEY`, and a **distinct**
`PRODUCT_PAGE_PREVIEW_SECRET`. `src/config/env.ts` enforces all of this at
boot.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with reload, loads `.env` |
| `npm run build` | Compiles `src/` to `dist/` |
| `npm start` | Runs the compiled build, loads `.env` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Runs the test suite against `.env.test` (needs a `volrep_test` database — see below) |
| `npm run db:generate` | Diffs the schema and writes a new migration file under `drizzle/` |
| `npm run db:migrate` | Applies pending migrations using `.env`'s `DATABASE_URL` |
| `npm run db:migrate:test` | Same, against `.env.test`'s database |
| `npm run db:seed` | Reconciles the VOLREP catalog into `.env`'s database (idempotent — safe to re-run) |
| `npm run db:seed:test` | Same, against `.env.test`'s database |
| `npm run db:studio` | Opens Drizzle Studio against `.env`'s database |

## Catalog seed

`src/db/seed.ts` writes the one real product the storefront sells — the
**Volrep PRM™ Percussive Recovery Massager** (`volrep-prm`), two colour
variants at 899.00 MAD (compare-at 1099.00 MAD). It reconciles every row
against a stable natural key, so running it repeatedly never creates a
duplicate product / variant / image / option. It refuses to run with
`NODE_ENV=production` unless passed `--force`.

Seeded stock (`DEV_TEST_STOCK`) is **development/test inventory only**, not
real warehouse stock. Product imagery currently points at the store's
existing Shopify file CDN; moving it to Volrep-owned storage is a later
task. Reviews are intentionally left empty — the seed also strips any
order-less (fabricated) review rows for the product.

```bash
npm run db:seed
```

## Admin API

Session-cookie–authenticated management API under `/api/admin/*` (Phase 7).
Entirely separate from the storefront's `x-internal-api-key` — that header
is not accepted on any admin route. Roles: `owner` and `staff`.

Create the first admin from the CLI (there is no self-serve signup):

```bash
npm run admin:create -- --email you@volrep.com --role owner
# prints a generated password once if --password is omitted
```

Then `POST /api/admin/auth/login` sets an httpOnly `volrep_admin_session`
cookie (12h absolute expiry, `ADMIN_SESSION_TTL_HOURS`). Surfaces:
auth (`login`/`logout`/`me`), orders (list/detail/status-transition/
fulfillment+manual tracking), products & variants, inventory adjustments
(reason-tagged, audited via `admin_audit_log` — no separate table),
review moderation (approve/reject; `verified_purchase` is never settable),
shipping settings (owner-only), and a read-only `audit-log`.

## Test database

Tests run against a **separate** database so they never touch dev data:

```bash
createdb volrep_test
cp .env.example .env.test   # set DATABASE_URL to volrep_test, LOG_LEVEL=silent
npm run db:migrate:test
npm test
```

Each test file truncates every table before its tests run (`src/test/reset-db.ts`)
and resets `order_number_seq` back to 1001, so runs are deterministic.

## Project structure

```
src/
  config/env.ts       Zod-validated environment — fails fast on boot if
                       anything required is missing or malformed
  db/
    schema/            One file per domain cluster (catalog, cart, orders,
                        reviews, shipping, admin, email) + enums
    client.ts          Drizzle + postgres.js connection
    migrate.ts          Programmatic migration runner (used by db:migrate)
  lib/errors.ts        AppError — the one error type every service throws
  plugins/error-handler.ts   Single Fastify error handler; never leaks a
                              raw stack trace or DB error to a client
  routes/health.ts      GET /health
  app.ts                Builds the Fastify instance (plugins, routes)
  server.ts             Starts listening, handles graceful shutdown
drizzle/                 Generated SQL migrations — plain, readable, and
                          safe to hand-edit (see 0000_*.sql's tail for an
                          example: a hand-added ALTER SEQUENCE ... OWNED BY)
```

## V1 scope note: Cash on Delivery only

`checkout_sessions.provider` is a plain text column, not an enum, and V1
only ever writes `'cod'` to it. A COD checkout creates and completes a
session synchronously in the same request (no redirect, no webhook) and
creates the order directly with `status = 'pending_payment'`. No Stripe/CMI
integration, SDK, or webhook exists yet — see the architecture document's
§07 for how a card provider slots into this same table and the same
`orders`/`order_line_items` schema later without a rewrite.

## Status

**Done (this session):** project scaffold, environment validation, full
Drizzle schema (18 tables incl. `order_number_seq`), generated + applied
migration, Fastify app shell with error handling / CORS / cookies / rate
limiting, `GET /health`, a passing test suite exercising the schema's
actual guarantees (order-number sequencing, the webhook-retry idempotency
constraint, the generated `verified_purchase` column, stock/quantity check
constraints) against a real Postgres database.

**Not started:** every storefront route beyond `/health` (products, cart,
COD checkout, order tracking, reviews), all admin routes and auth, email
outbox delivery, and any frontend integration.
