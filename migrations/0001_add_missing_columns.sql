-- 既存の staffs テーブルに対して、最近追加されたカラムを追加します
-- （SQLite では ADD COLUMN IF NOT EXISTS が使えないため、すでに存在する場合はエラーになりますが問題ありません）

ALTER TABLE staffs ADD COLUMN weeklyHoursTarget REAL;
ALTER TABLE staffs ADD COLUMN isHelpStaff INTEGER DEFAULT 0;
ALTER TABLE staffs ADD COLUMN defaultWorkingHoursStart TEXT;
ALTER TABLE staffs ADD COLUMN defaultWorkingHoursEnd TEXT;
ALTER TABLE staffs ADD COLUMN display_order INTEGER DEFAULT 0;
ALTER TABLE staffs ADD COLUMN access_key TEXT;
