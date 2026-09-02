-- 0002: tenancy core (GUIDELINES.md §3)

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    status      TEXT NOT NULL DEFAULT 'Active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id     UUID NOT NULL REFERENCES tenants(id),
    email         CITEXT NOT NULL UNIQUE,
    full_name     TEXT,
    avatar_url    TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'Member',
    -- theme / mode / language / wallpaper / custom theme JSON
    prefs         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- every tenant-data index leads with tenant_id
CREATE INDEX idx_users_tenant ON users (tenant_id, id);
CREATE INDEX idx_users_tenant_role ON users (tenant_id, role);

-- Row-Level Security: defense in depth; app sets app.tenant_id per tx
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- service role used by migrations/admin bypasses via BYPASSRLS
