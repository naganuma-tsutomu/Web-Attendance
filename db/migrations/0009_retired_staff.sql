-- Keep former staff records so historical shifts can still resolve their names.
ALTER TABLE staffs ADD COLUMN retired_at TEXT;
CREATE INDEX IF NOT EXISTS idx_staffs_retired_at ON staffs(retired_at);
