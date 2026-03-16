-- 役職テーブルに週間目標時間を追加 (null 許容)
ALTER TABLE roles ADD COLUMN weeklyHoursTarget INTEGER;

-- スタッフテーブルに週間目標時間を追加 (null 許容)
ALTER TABLE staffs ADD COLUMN weeklyHoursTarget INTEGER;
