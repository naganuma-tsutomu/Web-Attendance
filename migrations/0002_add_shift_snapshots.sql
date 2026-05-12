-- ============================================================
-- Migration 0002: シフトスナップショットテーブル追加
-- ============================================================
--
-- 既存 D1 データベースへシフト情報のバックアップ/復元機能を追加する。
--
-- 【実行コマンド】
--   wrangler d1 execute web-attendance-db --file=migrations/0002_add_shift_snapshots.sql
--
-- ローカルで事前検証する場合:
--   wrangler d1 execute web-attendance-db --local --file=migrations/0002_add_shift_snapshots.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS shift_snapshots (
    id TEXT PRIMARY KEY,
    yearMonth TEXT NOT NULL,
    label TEXT,
    reason TEXT NOT NULL,
    shifts_json TEXT NOT NULL,
    fixed_dates_json TEXT NOT NULL DEFAULT '[]',
    shift_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shift_snapshots_ym_created
ON shift_snapshots(yearMonth, created_at DESC);
