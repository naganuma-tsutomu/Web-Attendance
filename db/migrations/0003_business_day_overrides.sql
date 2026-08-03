CREATE TABLE IF NOT EXISTS business_day_overrides (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_business_day_overrides_date
    ON business_day_overrides(date);
