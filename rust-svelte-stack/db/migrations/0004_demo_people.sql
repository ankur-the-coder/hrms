-- 0004: demo people — data source for the shared DataTable playground
CREATE TABLE demo_people (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    full_name   TEXT NOT NULL,
    dept        TEXT NOT NULL,
    role        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Active',
    city        TEXT NOT NULL DEFAULT '',
    joined      DATE NOT NULL DEFAULT CURRENT_DATE,
    salary      BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_demo_people_tenant ON demo_people (tenant_id, id);
CREATE INDEX idx_demo_people_tenant_dept ON demo_people (tenant_id, dept);
ALTER TABLE demo_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_people_tenant_isolation ON demo_people
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
