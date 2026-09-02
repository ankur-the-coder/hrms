# Aviary HRMS — Production Stack (Rust + Svelte + PostgreSQL)

Full mirror of the React preview app, per GUIDELINES.md at repo root.

```
backend/    Axum 0.8 + SQLx (compile-checked queries), modular monolith
frontend/   SvelteKit 2 + Svelte 5 runes, token-driven theme system
db/         Raw forward-only SQL migrations (0001 … 0007)
```

## Run

```bash
# 1 · database
createdb aviary
for f in db/migrations/*.sql; do psql aviary -f "$f"; done

# 2 · backend  (listens on :8080)
cd backend
DATABASE_URL=postgres://localhost/aviary \
  APP_ENC_KEY=<32-byte-hex> APP_IDX_KEY=<32-byte-hex> JWT_SECRET=dev \
  cargo run

# 3 · frontend (dev server proxies /api → :8080)
cd frontend
npm i && npm run dev
```

## Structure

### backend/src
| File | Purpose |
|---|---|
| `main.rs` | Router assembly + CORS/trace/compression layers |
| `config.rs` | Env config (DB URL, JWT secret, AES + HMAC keys) |
| `db.rs` | SQLx pool (small per-instance; PgBouncer in front) |
| `error.rs` | `AppError` → JSON error responses |
| `crypto.rs` | AES-256-GCM field encryption + HMAC blind indexes |
| `tenant.rs` | JWT extractor + RLS tenant binding per transaction |
| `modules/auth.rs` | signup / login / me (Argon2 + JWT) |
| `modules/prefs.rs` | user prefs (theme/font/wallpaper JSONB) |
| `modules/demo_people.rs` | playground DataTable source (keyset paging, bulk ops) |
| `modules/organization.rs` | org people (demographic filters) + audit events |
| `modules/orgstructure.rs` | 7-collection bootstrap, whitelisted CRUD, bulk-assign, CSV link fetch |

### frontend/src
| Path | Purpose |
|---|---|
| `app.html / app.css` | Shell + full 5-theme (light/dark) token system |
| `lib/api.ts` | Fetch wrapper (JWT), pdfMake/ExcelJS CDN loaders, iframe print |
| `lib/tooltip.ts` | Global viewport-clamped `[data-tip]` tooltip layer |
| `lib/stores/session.ts` | JWT session store + `/auth/me` hydration |
| `lib/stores/theme.ts` | Theme/mode/font/wallpaper/custom store + AI prompt |
| `lib/components/` | Sidebar, Topbar (global search, alerts, messages), ProfileMenu (theme/font/wallpaper/dark-mode), Login (flap-sweep), Modal, Drawer, NeuLoader, ImportWizard (file + GSheets/OneDrive link), DataTable (6 views, kanban DnD, exports: PDF/Excel/CSV/Print, hyperlinked Excel detail sheets), Chart (2D/3D, 7 kinds, leader labels, fullscreen, exports), StackedColumns, NeuDonut, Select, pickers (Date, DateRange w/ trench+hover preview, Month + MonthRange, Time w/ clock-wheel-slider) |
| `routes/+layout.svelte` | Auth guard, sidebar/topbar shell, wallpaper layer |
| `routes/login` | Luxury flap-sweep auth card |
| `routes/home` | Landing cards |
| `routes/playground` | Component kit demo against `/demo-people` |
| `routes/organization/dashboard/[[tab]]` | Summary · Analytics (10-chart demographics, growth, attrition, 7 shared filters + Exit Types) · Employee Reports · Audit Logs (6 filters + reset) |
| `routes/organization/structure/[[section]]` | Legal Entities (signatories, banks, payroll tasks) · Business Units · Locations (map + import) · Departments (wall settings) · Cost Centers · Pay Grades · Bands, with bulk-assign wizard |

### db/migrations
| File | Contents |
|---|---|
| `0001` | pgcrypto, citext, pg_trgm |
| `0002` | tenants + users (RLS, composite tenant-first indexes) |
| `0003` | encrypted employees pattern (AES blobs + blind indexes, 16-way hash partitions) + audit_log |
| `0004` | demo_people (playground) |
| `0005` | org_people + audit view indexes |
| `0006` | people (full demographics) + audit_events (partitioned) |
| `0007` | legal_entities, business_units, org_locations, org_departments, cost_centers, pay_grades, bands (all RLS) |
