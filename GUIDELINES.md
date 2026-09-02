# Aviary HRMS — Enterprise Engineering Guidelines (v2)

This document is the single source of truth for how Aviary is built from now on.
Two parallel stacks are maintained at all times:

| Purpose | Stack | Location |
|---|---|---|
| Live preview / demo | React 19 + Vite + Vercel functions + Supabase Postgres | repo root (`src/`, `api/`) |
| Production target | Rust (Axum + SQLx) + SvelteKit + raw PostgreSQL | `/rust-svelte-stack/` |

**Every feature shipped in React MUST have its equivalent committed to
`/rust-svelte-stack` in the same change set** (backend route, Svelte component,
SQL migration).

---

## 1. Chosen technologies & why (long-term support)

- **Rust backend: Axum 0.8 + Tokio + SQLx + tower-http.** Axum is maintained by
  the Tokio team (the foundation of async Rust) — the safest LTS bet in the
  ecosystem. SQLx gives compile-time-checked SQL against a real database with
  zero ORM runtime cost. `tower` middleware composes cleanly (auth, rate
  limits, tracing). Auxiliary crates: `serde`, `thiserror`, `tracing`,
  `jsonwebtoken`, `argon2`, `aes-gcm`, `hmac`/`sha2`, `uuid`, `chrono`,
  `validator`. All are de-facto standards with multi-year maintenance history.
- **Svelte frontend: SvelteKit 2 + Svelte 5 (runes) + TypeScript.** Compiles
  away the framework, smallest runtime, official Vercel/Node adapters.
- **PostgreSQL 15+** with `pgcrypto`, `citext`, `pg_trgm`, native partitioning.
- **Connection pooling: PgBouncer in transaction mode** in front of Postgres.
  Rust uses a small SQLx pool (per-instance 10–20 conns) → PgBouncer fans in.
- **Cache/queue (when needed): Redis** — introduced only when a measured
  hotspot exists; never speculatively.

## 2. Repository layout

```
/src                      React preview app
  /shared                 Reusable UI kit (DataTable, pickers, selects, primitives)
  /theme                  Theme engine (tokens, presets, custom-import)
  /contexts               Auth/session state
  /pages                  Route-level screens (feature folders)
  /lib                    api client, supabase, helpers
/api                      Vercel serverless functions (thin — validation + SQL)
/rust-svelte-stack
  /backend/src
    main.rs               router assembly + layers only
    config.rs  db.rs  error.rs  crypto.rs  tenant.rs
    /modules/<feature>.rs handlers + queries per bounded context
  /frontend/src/lib
    /components           1:1 ports of /src/shared
    /stores               theme, session
  /db/migrations          NNNN_name.sql — forward-only, never edited after merge
```

**Code-reuse rules**
1. UI is token-driven: components consume CSS variables (`--t-*`) only — the
   same stylesheet contract is used by React and Svelte, so themes are written
   once and ported mechanically.
2. One shared `DataTable`, one family of pickers, one `Select`. Feature screens
   are *configuration* of shared components, never re-implementations.
3. Backend: handlers stay <50 lines; shared logic lives in `crypto.rs`,
   `tenant.rs`, query helpers. SQL lives next to the module that owns it.
4. Types cross the wire as explicit DTOs (serde structs / TS interfaces);
   no leaking of row types into the UI.

## 3. Multi-tenant database design (1000+ orgs × 5k+ employees)

**Model: single database, shared schema, mandatory `tenant_id UUID` on every
tenant-owned row.** At ~5M+ employee rows this is comfortably within Postgres
range and operationally far cheaper than schema-per-tenant at 1000 tenants
(catalog bloat, migration fan-out). Escape hatch: the largest tenants can be
moved to a dedicated database later because every query is already
tenant-scoped.

Mandatory rules:
- **Every index on tenant data is composite and leads with `tenant_id`**:
  `(tenant_id, <selective column>)`. Never index a tenant column alone.
- **Row-Level Security on every tenant table**:
  `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
  The backend sets `SET LOCAL app.tenant_id = $1` at transaction start
  (`tenant.rs` extractor does this automatically). Defense in depth — even a
  buggy query cannot cross tenants.
- **Hash partitioning for hot, ever-growing tables** (`attendance_events`,
  `audit_log`, `payroll_items`): `PARTITION BY HASH (tenant_id)`, 16 partitions
  to start. Keeps indexes shallow and autovacuum effective.
- **Keyset pagination only** (`WHERE (tenant_id,id) > ($1,$2) LIMIT n`);
  OFFSET is banned on large tables.
- Aggregates that dashboards need repeatedly are **materialized per tenant**
  into summary tables updated by triggers or scheduled jobs — dashboards never
  scan raw event tables.
- `created_at`/`updated_at` on everything; soft-delete (`deleted_at`) for
  anything referenced elsewhere; hard delete is an admin-only, audited action.

## 4. Encrypted-but-searchable sensitive fields

Applies to: phone, personal email, address, government/document numbers, bank
account numbers.

Pattern: **AES-256-GCM application-layer encryption + HMAC blind index.**

```
phone_enc   BYTEA      -- AES-256-GCM(nonce || ciphertext || tag)
phone_bidx  TEXT       -- hex(HMAC-SHA256(index_key, normalize(phone)))
```

- Data key and index key are separate keys, delivered via KMS envelope
  encryption in production (`crypto.rs` reads them from env/KMS; preview stack
  derives them from an env secret).
- **Equality search** = compute blind index of the search term, query
  `WHERE tenant_id=$1 AND phone_bidx=$2` — fully indexed, O(log n).
- **Prefix/partial search** where genuinely required (e.g. phone last-4):
  store additional blind indexes of normalized variants (`phone_last4_bidx`).
  Never trigram-index plaintext of sensitive fields.
- Normalization before hashing: lowercase, strip spaces/`+`/`-` for phones,
  lowercase+trim for emails.
- Plaintext never leaves the backend unencrypted at rest, never logged, and
  decrypt happens only for authorized field-level scopes (mask by default:
  `+91 ••••• 4321`).
- Key rotation: versioned key id prefix inside the ciphertext blob
  (`v1:` …), background re-encrypt job per tenant.

## 5. Backend performance rules

- All list endpoints: tenant-scoped, keyset-paginated, hard `LIMIT` cap (200).
- N+1 is banned — batch with `= ANY($1)` / joins; verified in review.
- Statement timeout 5s app-wide; long work goes to background jobs.
- Per-tenant rate limiting at the edge (tower middleware, token bucket).
- Read/write splitting ready: repos take a `Executor` so read replicas can be
  introduced without code change.
- Observability: `tracing` spans carry `tenant_id` + `request_id`; slow-query
  log threshold 250ms.

## 6. Frontend architecture rules

- Feature folders under `/pages`; shared visual language only via `/shared`.
- Server state: fetch-on-mount + explicit refetch after mutation (preview);
  SvelteKit `load` + invalidation (production). No global client caches until
  scale demands them.
- Every async surface has: skeleton state, empty state, error state.
- All components must render correctly under every theme — they may only use
  token utilities/classes (`tk-*`, semantic Tailwind colors), never raw hex.
- Route transitions and micro-interactions are standardized (motion presets in
  `/shared`), not hand-rolled per page.

## 7. Theming contract

Themes are pure CSS-variable sets applied on `<html data-theme data-mode>`:
`--t-bg, --t-surface, --t-surface2, --t-ink, --t-muted, --t-accent,
--t-accent-deep, --t-glow, --t-gold, --t-gold-deep, --t-border, --t-radius,
--t-radius-lg, --t-shadow-card, --t-shadow-pop, --t-inset, --t-font-display,
--t-font-body`.
Built-ins: `soft` (default, neumorphic), `basic`, `brutal`, `glass`, `anime`.
`custom` is user-imported JSON (schema in `src/theme/themes.ts`, generated by
the provided AI prompt) applied as inline variables. Light/dark is a second
axis every theme must define.

## 8. Migrations & API policy

- SQL migrations are forward-only, numbered, raw `.sql`, one concern each.
- API is versioned under `/api/v1/`; breaking changes require `/v2`.
- Every mutation writes an `audit_log` row (actor, tenant, entity, diff).

## 9. Definition of done (every PR)

1. React preview works end-to-end against Supabase.
2. `/rust-svelte-stack` equivalents updated (route + component + migration).
3. States covered: loading / empty / error / mobile / all themes.
4. No plaintext sensitive data in logs, fixtures, or seeds.
