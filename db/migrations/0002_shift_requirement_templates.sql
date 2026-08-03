CREATE TABLE IF NOT EXISTS shift_requirement_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shift_requirement_template_items (
    id TEXT PRIMARY KEY,
    templateId TEXT NOT NULL,
    classId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    minStaffCount INTEGER NOT NULL DEFAULT 1,
    maxStaffCount INTEGER,
    priority INTEGER DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(templateId) REFERENCES shift_requirement_templates(id) ON DELETE CASCADE,
    FOREIGN KEY(classId) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shift_requirement_template_items_template
    ON shift_requirement_template_items(templateId, display_order);
