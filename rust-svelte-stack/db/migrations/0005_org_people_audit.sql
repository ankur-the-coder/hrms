-- 0005: Organization module — people roster + audit logs

CREATE TABLE org_people (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    full_name       TEXT NOT NULL,
    email           CITEXT,
    gender          TEXT,
    dept            TEXT,
    role            TEXT,
    status          TEXT NOT NULL DEFAULT 'Active',   -- Active | Onboarding | Probation | Exited
    location        TEXT,
    employment_type TEXT NOT NULL DEFAULT 'Full-time',
    joined          DATE NOT NULL,
    exit_date       DATE,
    exit_reason     TEXT,
    dob             DATE,
    salary          BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_org_people_tenant     ON org_people (tenant_id, id);
CREATE INDEX idx_org_people_tenant_dept ON org_people (tenant_id, dept);
CREATE INDEX idx_org_people_tenant_status ON org_people (tenant_id, status);
CREATE INDEX idx_org_people_tenant_joined ON org_people (tenant_id, joined DESC);
ALTER TABLE org_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_people_tenant_isolation ON org_people
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- audit_log already exists (0003) as the partitioned append-only table;
-- this view narrows it for the Org dashboard's default query shape.
CREATE INDEX IF NOT EXISTS idx_audit_tenant_cat_time
    ON audit_log (tenant_id, entity, created_at DESC);
