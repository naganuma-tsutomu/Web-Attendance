-- Month revisions protect full-month replacement from stale browser data.
CREATE TABLE IF NOT EXISTS shift_month_versions (
    year_month TEXT PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 0,
    lock_token TEXT
);

INSERT INTO shift_month_versions (year_month, version)
SELECT substr(date, 1, 7), COUNT(*) FROM shifts GROUP BY substr(date, 1, 7)
ON CONFLICT(year_month) DO NOTHING;

CREATE TRIGGER IF NOT EXISTS shifts_version_after_insert AFTER INSERT ON shifts BEGIN
    INSERT INTO shift_month_versions (year_month, version) VALUES (substr(NEW.date, 1, 7), 1)
    ON CONFLICT(year_month) DO UPDATE SET version = version + 1;
END;
CREATE TRIGGER IF NOT EXISTS shifts_version_after_delete AFTER DELETE ON shifts BEGIN
    INSERT INTO shift_month_versions (year_month, version) VALUES (substr(OLD.date, 1, 7), 1)
    ON CONFLICT(year_month) DO UPDATE SET version = version + 1;
END;
CREATE TRIGGER IF NOT EXISTS shifts_version_after_update AFTER UPDATE ON shifts BEGIN
    INSERT INTO shift_month_versions (year_month, version) VALUES (substr(OLD.date, 1, 7), 1)
    ON CONFLICT(year_month) DO UPDATE SET version = version + 1;
    INSERT INTO shift_month_versions (year_month, version)
    SELECT substr(NEW.date, 1, 7), 1 WHERE substr(NEW.date, 1, 7) <> substr(OLD.date, 1, 7)
    ON CONFLICT(year_month) DO UPDATE SET version = version + 1;
END;
