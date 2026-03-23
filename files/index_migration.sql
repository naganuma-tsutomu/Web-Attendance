-- インデックス追加マイグレーション
CREATE INDEX IF NOT EXISTS idx_staff_available_days_staffid ON staff_available_days(staffId);
CREATE INDEX IF NOT EXISTS idx_shift_preferences_staffid_ym ON shift_preferences(staffId, yearMonth);
