-- ============================================================
-- Migration 0003: 当番番号の一意制約をクラス単位に変更
-- ============================================================
--
-- 従来: 同じ日付ではクラスが違っても同じ duty_number を保存できない
-- 変更: 同じ日付・同じクラス内でのみ duty_number の重複を防ぐ
--
-- 【実行コマンド】
--   wrangler d1 execute web-attendance-db --file=migrations/0003_scope_duty_number_by_class.sql
--
-- ローカルで事前検証する場合:
--   wrangler d1 execute web-attendance-db --local --file=migrations/0003_scope_duty_number_by_class.sql
-- ============================================================

DROP INDEX IF EXISTS idx_shifts_date_duty_number;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_date_class_duty_number
ON shifts(date, classType, duty_number)
WHERE duty_number IS NOT NULL;
