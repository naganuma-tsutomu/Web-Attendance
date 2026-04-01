-- shift_preferences テーブルに submitted カラムを追加します
-- 0: 未提出（スタッフ本人が提出していない）
-- 1: 提出済み（スタッフ本人が提出した）
ALTER TABLE shift_preferences ADD COLUMN submitted INTEGER DEFAULT 0;
