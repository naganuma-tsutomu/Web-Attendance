-- Normalize restored/legacy databases where shift_preferences.staffId still uses
-- the default NO ACTION behavior. Rebuilding is required because SQLite cannot
-- alter an existing foreign-key action in place.
PRAGMA defer_foreign_keys = ON;

DROP TABLE IF EXISTS shift_preferences_new;

CREATE TABLE shift_preferences_new (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL,
    submitted INTEGER DEFAULT 0,
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

INSERT INTO shift_preferences_new (id, staffId, yearMonth, submitted)
SELECT id, staffId, yearMonth, submitted
FROM shift_preferences;

DROP TABLE shift_preferences;
ALTER TABLE shift_preferences_new RENAME TO shift_preferences;

CREATE INDEX IF NOT EXISTS idx_shift_preferences_staffid_ym
    ON shift_preferences(staffId, yearMonth);

PRAGMA defer_foreign_keys = OFF;
