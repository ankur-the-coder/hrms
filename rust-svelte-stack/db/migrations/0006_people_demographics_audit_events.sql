-- 0006: enterprise demographics roster + structured audit events
-- (mirrors the preview tables hrms_people / hrms_audit_events)

CREATE TABLE people (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    full_name       TEXT NOT NULL,
    email           CITEXT,
    gender          TEXT,               -- Female | Male | Non-binary | Not Specified | ...
    dept            TEXT,
    role            TEXT,
    status          TEXT NOT NULL DEFAULT 'Active',   -- Active | Onboarding | Probation | Exited
    location        TEXT,
    employment_type TEXT,               -- Full Time | Part Time | None
    worker_type     TEXT,               -- Permanent | Contingent
    nationality     TEXT,
    business_unit   TEXT,
    cost_center     TEXT,
    legal_entity    TEXT,
    joined          DATE NOT NULL,
    exit_date       DATE,
    exit_reason     TEXT,
    exit_type       TEXT,               -- Voluntary | Involuntary | Retirement | Contract End
    dob             DATE,
    salary          BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_people_tenant        ON people (tenant_id, id);
CREATE INDEX idx_people_tenant_dept   ON people (tenant_id, dept);
CREATE INDEX idx_people_tenant_status ON people (tenant_id, status);
CREATE INDEX idx_people_tenant_bu     ON people (tenant_id, business_unit);
CREATE INDEX idx_people_tenant_joined ON people (tenant_id, joined DESC);
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
CREATE POLICY people_tenant_isolation ON people
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE TABLE audit_events (
    id           BIGINT GENERATED ALWAYS AS IDENTITY,
    tenant_id    UUID NOT NULL,
    actor        TEXT NOT NULL DEFAULT 'Admin',
    category     TEXT NOT NULL DEFAULT 'Org',
    sub_category TEXT,
    attribute    TEXT,
    event        TEXT NOT NULL,
    detail       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);
DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE audit_events_p%s PARTITION OF audit_events FOR VALUES WITH (MODULUS 16, REMAINDER %s)', i, i);
  END LOOP;
END $$;
CREATE INDEX idx_audit_events_tenant_time ON audit_events (tenant_id, created_at DESC);
CREATE INDEX idx_audit_events_tenant_cat  ON audit_events (tenant_id, category, created_at DESC);
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_tenant_isolation ON audit_events
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
