-- 0007: Org Structure — legal entities, business units, locations,
-- departments, cost centers, pay grades, bands (mirrors preview tables)

CREATE TABLE legal_entities (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    name               TEXT NOT NULL,
    legal_name         TEXT,
    cin                TEXT,
    incorporation_date DATE,
    business_type      TEXT,
    sector             TEXT,
    nature             TEXT,
    phone              TEXT,
    email              CITEXT,
    website            TEXT,
    address1           TEXT, address2 TEXT, city TEXT, state TEXT, zip TEXT, country TEXT,
    signatories        JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- bank account numbers are stored masked; full numbers go through the
    -- encrypted-field pattern (§4 GUIDELINES) when payments ship
    bank_accounts      JSONB NOT NULL DEFAULT '[]'::jsonb,
    payroll_tasks      JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX idx_legal_entities_tenant ON legal_entities (tenant_id, id);

CREATE TABLE business_units (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    head        TEXT,
    parent      TEXT,
    description TEXT
);
CREATE INDEX idx_business_units_tenant ON business_units (tenant_id, id);

CREATE TABLE org_locations (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    group_email CITEXT,
    timezone    TEXT,
    country     TEXT, state TEXT, address1 TEXT, address2 TEXT, city TEXT, zip TEXT,
    description TEXT
);
CREATE INDEX idx_org_locations_tenant ON org_locations (tenant_id, id);

CREATE TABLE org_departments (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    name               TEXT NOT NULL,
    display_name       TEXT,
    parent_id          BIGINT REFERENCES org_departments(id),
    head               TEXT,
    description        TEXT,
    wall_posts         BOOLEAN NOT NULL DEFAULT true,
    wall_announcements BOOLEAN NOT NULL DEFAULT false,
    wall_polls         BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_org_departments_tenant ON org_departments (tenant_id, id);
CREATE INDEX idx_org_departments_parent ON org_departments (tenant_id, parent_id);

CREATE TABLE cost_centers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    code        TEXT,
    head        TEXT,
    description TEXT
);
CREATE INDEX idx_cost_centers_tenant ON cost_centers (tenant_id, id);
CREATE UNIQUE INDEX idx_cost_centers_code ON cost_centers (tenant_id, code);

CREATE TABLE pay_grades (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    description TEXT
);
CREATE INDEX idx_pay_grades_tenant ON pay_grades (tenant_id, id);

CREATE TABLE bands (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    description TEXT
);
CREATE INDEX idx_bands_tenant ON bands (tenant_id, id);

-- RLS on every table
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['legal_entities','business_units','org_locations','org_departments','cost_centers','pay_grades','bands'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I_tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)', t, t);
  END LOOP;
END $$;
