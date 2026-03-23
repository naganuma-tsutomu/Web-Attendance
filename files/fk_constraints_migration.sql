-- 外部キー制約の追加マイグレーション
-- SQLiteはALTER TABLE ADD CONSTRAINTを未サポートのため、テーブル再作成で対応
--
-- 修正内容:
--   1. shift_preferences.staffId に ON DELETE CASCADE を追加
--   2. shifts.staffId に FOREIGN KEY(staffs) ON DELETE CASCADE を追加
--   3. shifts.classType に FOREIGN KEY(classes) ON DELETE CASCADE を追加

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- ----------------------------------------------------------------
-- 1. shift_preferences: ON DELETE CASCADE を追加
-- ----------------------------------------------------------------
CREATE TABLE shift_preferences_new (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL,
    unavailableDates TEXT NOT NULL,
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);
INSERT INTO shift_preferences_new SELECT * FROM shift_preferences;
DROP TABLE shift_preferences;
ALTER TABLE shift_preferences_new RENAME TO shift_preferences;

-- ----------------------------------------------------------------
-- 2. shifts: staffId・classType に FK制約を追加
-- ----------------------------------------------------------------
CREATE TABLE shifts_new (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    staffId TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    classType TEXT NOT NULL,
    isEarlyShift INTEGER DEFAULT 0,
    isError INTEGER DEFAULT 0,
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE,
    FOREIGN KEY(classType) REFERENCES classes(id) ON DELETE CASCADE
);
INSERT INTO shifts_new SELECT * FROM shifts;
DROP TABLE shifts;
ALTER TABLE shifts_new RENAME TO shifts;

-- インデックスの再作成（DROP TABLE で削除されるため）
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staffId, date);

COMMIT;

PRAGMA foreign_keys = ON;
