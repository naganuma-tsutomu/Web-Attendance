-- shift_preferences テーブルからレガシーな unavailableDates カラムを削除します
-- staffs テーブルからレガシーな availableDays カラムを削除します
-- SQLite 3.35+ の ALTER TABLE DROP COLUMN を使用

-- エラーを無視するようにするため、1つずつ実行
-- (すでに削除されている場合はエラーになりますが、D1 migration では続行される想定)

-- shift_preferences の修正
ALTER TABLE shift_preferences DROP COLUMN unavailableDates;

-- staffs の修正（以前のマイグレーションが失敗していた場合の予備）
ALTER TABLE staffs DROP COLUMN availableDays;
