# VOLREP backend — production deployment checklist

The backend is one small process on a single VPS, sitting **behind** a
reverse proxy. It is never the public entry point.

```
Internet
  │  :443 (TLS)
  ▼
Nginx / Caddy   ── serves /media/* directly (optional, preferred)
  │  loopback
  ▼
Next.js storefront (volrep-maroc)   +   volrep-admin
  │  loopback  (x-internal-api-key)      │  loopback (browser → api, session cookie)
  ▼                                      ▼
Fastify backend  (127.0.0.1:4000)
  │  loopback  (or TLS to a managed DB)
  ▼
PostgreSQL
```

## Checklist

### Network / exposure

1. **The backend must not be directly reachable from the public internet.**
   Only the reverse proxy talks to it.
2. **Nginx / Caddy is the public reverse proxy** — it terminates TLS,
   redirects HTTP → HTTPS, and is the only thing bound to `:80` / `:443`.
3. **The backend listens on loopback.** Leave `HOST` at its default
   `127.0.0.1` for the co-located topology above. Only set `HOST=0.0.0.0`
   for a genuine split-host deployment (backend on a different machine than
   Nginx) — a non-loopback `HOST` in `NODE_ENV=production` logs a warning at
   boot.
4. **Firewall the Fastify port** (`PORT`, default `4000`) from the public
   internet even though it binds loopback — defence in depth. `ufw deny
   4000` / a security-group rule with no public ingress.

### Secrets (`NODE_ENV=production` env validation enforces §5–7)

5. **`INTERNAL_API_KEY`** — a real random secret, **≥ 32 characters**, not a
   placeholder. `openssl rand -hex 32` (→ 64 hex chars). The
   `volrep-maroc` storefront must be given the **same** value as
   `VOLREP_INTERNAL_API_KEY`.
6. **`LIRYA_API_KEY`** (only if the Lirya integration is configured) — a
   real random secret, **≥ 32 characters**, not a placeholder.
7. **`PRODUCT_PAGE_PREVIEW_SECRET`** — **required** in production, a
   **distinct** real random secret, **≥ 32 characters**, not a placeholder,
   and **not a copy of `INTERNAL_API_KEY`**. `openssl rand -hex 32`.

Boot fails fast (`process.exit(1)` from `src/config/env.ts`) with a clear
message if any of these are missing / too short / placeholder-looking, or if
the preview secret equals the internal key.

### Database

8. **A remote production PostgreSQL must use TLS.** Append an explicit TLS
   directive to `DATABASE_URL` or env validation fails:
   - `?sslmode=require` — encrypt, no certificate verification
   - `?sslmode=verify-full` — encrypt **and** verify the server certificate
     (preferred for a managed DB with a real chain)
   - `?ssl=true` — also accepted (postgres.js honours it directly)

   `sslmode=prefer` / `sslmode=allow` are **rejected** — they silently fall
   back to plaintext. A `localhost` / `127.0.0.1` / `::1` / unix-socket
   `DATABASE_URL` is exempt (the traffic never leaves the host).

10. **Run `npm run db:migrate` on deploy.** Migration `0006_tan_sunset_bain`
    (security hardening — Step 4 M1) changes `admin_sessions.id` from a raw
    `uuid` (which used to *be* the cookie value) to `text` holding
    `SHA-256(token)` — the raw session token is now generated in the app and
    only its hash is stored, so a DB leak no longer exposes usable admin
    sessions. **Consequence:** the migration `DELETE`s all existing
    `admin_sessions` rows (they can never match a hash lookup again), so
    every currently signed-in admin is logged out and must sign in again
    after this deploy. No data beyond live sessions is affected; there is no
    rollout window to coordinate (12 h TTL, few users).

### Media

9. **Local media storage is acceptable for the current single-VPS
   architecture** (`MEDIA_STORAGE_DRIVER=local`). Two ways to keep image
   traffic off the Node event loop and the backend off the public internet:

   - **Preferred now:** let the reverse proxy serve `MEDIA_LOCAL_DIR`
     directly and never proxy `/media/*` to the backend:

     ```nginx
     # api.volrep.com
     location /media/ {
       alias /srv/volrep/volrep-backend/var/media/;
       add_header X-Content-Type-Options nosniff always;
       add_header Cross-Origin-Resource-Policy cross-origin always;
       add_header Content-Security-Policy "default-src 'none'; sandbox" always;
       add_header X-Frame-Options DENY always;
       expires 365d;
       access_log off;
     }
     location / {
       proxy_pass http://127.0.0.1:4000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
     ```

     (The backend still sets these same headers itself — see
     `src/plugins/security-headers.ts` — so serving through the backend is
     also safe if you skip the `alias` block.)

   - **Future / scaling:** switch `MEDIA_STORAGE_DRIVER=s3` and fill the
     `MEDIA_S3_*` values. `src/lib/media-storage` is an adapter — no
     application-code change. Not required for the initial launch.

## Reverse-proxy headers the backend relies on

Nginx / Caddy in front of the **storefront and the admin** must forward the
real client IP so the Step 1/4 rate limiters key on the visitor rather than
on one server address:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

The backend trusts these only from the address range in `TRUST_PROXY`
(default `loopback`). HSTS is emitted by the backend only when
`NODE_ENV=production` (`HSTS_MAX_AGE`, no `preload`).
