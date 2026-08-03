CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'staff', 'system')),
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    year_month TEXT,
    target_date TEXT,
    summary TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    metadata_json TEXT,
    request_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_year_month ON audit_logs(year_month, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, occurred_at DESC);
