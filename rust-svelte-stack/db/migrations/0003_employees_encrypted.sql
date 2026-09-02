-- 0003: employees with encrypted-but-searchable sensitive fields
-- (pattern table for the upcoming Org module — GUIDELINES.md §4)

CREATE TABLE employees (
    id               BIGINT GENERATED ALWAYS AS IDENTITY,
    tenant_id        UUID NOT NULL REFERENCES tenants(id),
    employee_no      TEXT NOT NULL,
    full_name        TEXT NOT NULL,
    work_email       CITEXT NOT NULL,          -- non-sensitive, searchable directly
    -- ===== encrypted fields: AES-256-GCM blob + HMAC blind index =====
    phone_enc        BYTEA,
    phone_bidx       TEXT,                     -- equality search
    phone_last4_bidx TEXT,                     -- partial (last-4) search
    personal_email_enc  BYTEA,
    personal_email_bidx TEXT,
    address_enc      BYTEA,
    doc_number_enc   BYTEA,                    -- PAN/Aadhaar/passport etc.
    doc_number_bidx  TEXT,
    -- ==================================================================
    status           TEXT NOT NULL DEFAULT 'Active',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);

-- 16 hash partitions keep indexes shallow at 5M+ rows
DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE employees_p%s PARTITION OF employees FOR VALUES WITH (MODULUS 16, REMAINDER %s)', i, i);
  END LOOP;
END $$;

CREATE UNIQUE INDEX idx_emp_tenant_no ON employees (tenant_id, employee_no);
CREATE UNIQUE INDEX idx_emp_tenant_email ON employees (tenant_id, work_email);
-- blind-index equality lookups: O(log n), never touches plaintext
CREATE INDEX idx_emp_phone_bidx ON employees (tenant_id, phone_bidx);
CREATE INDEX idx_emp_phone_l4_bidx ON employees (tenant_id, phone_last4_bidx);
CREATE INDEX idx_emp_pemail_bidx ON employees (tenant_id, personal_email_bidx);
CREATE INDEX idx_emp_doc_bidx ON employees (tenant_id, doc_number_bidx);
-- fuzzy people-search on NON-sensitive name only
CREATE INDEX idx_emp_name_trgm ON employees USING gin (full_name gin_trgm_ops);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY employees_tenant_isolation ON employees
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- audit log: hash-partitioned, append-only
CREATE TABLE audit_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY,
    tenant_id   UUID NOT NULL,
    actor_id    BIGINT,
    entity      TEXT NOT NULL,
    entity_id   TEXT,
    action      TEXT NOT NULL,
    diff        JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
) PARTITION BY HASH (tenant_id);
DO $$
BEGIN
  FOR i IN 0..15 LOOP
    EXECUTE format(
      'CREATE TABLE audit_log_p%s PARTITION OF audit_log FOR VALUES WITH (MODULUS 16, REMAINDER %s)', i, i);
  END LOOP;
END $$;
CREATE INDEX idx_audit_tenant_time ON audit_log (tenant_id, created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_isolation ON audit_log
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
