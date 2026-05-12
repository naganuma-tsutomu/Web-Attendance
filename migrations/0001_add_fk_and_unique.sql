-- ============================================================
-- Migration 0001: shifts テーブルへの FK 追加 + UNIQUE INDEX 追加
-- ============================================================
--
-- 対象環境: v2.4.4 以前から運用している既存 D1 データベース
-- 新規環境 (schema.sql で初期化済み) にはこのファイルは不要。
--
-- 【実行前に必ず行うこと】
-- 下記の重複チェッククエリを本番 D1 に対して実行し、
-- 結果が 0 件であることを確認してから本マイグレーションを流すこと。
--
--   # access_key 重複チェック
--   wrangler d1 execute web-attendance-db \
--     --command "SELECT access_key, COUNT(*) AS c FROM staffs WHERE access_key IS NOT NULL GROUP BY access_key HAVING c > 1;"
--
--   # (date, duty_number) 重複チェック
--   wrangler d1 execute web-attendance-db \
--     --command "SELECT date, duty_number, COUNT(*) AS c FROM shifts WHERE duty_number IS NOT NULL GROUP BY date, duty_number HAVING c > 1;"
--
-- 重複が見つかった場合は手動で修正してから実行すること。
--
-- 【実行コマンド】
--   wrangler d1 execute web-attendance-db --file=migrations/0001_add_fk_and_unique.sql
--
-- 【注意】
--   - Cloudflare D1 は部分インデックス (WHERE 句付き) をサポートしている。
--   - PRAGMA foreign_keys は D1 でも有効。shifts テーブル再作成中は OFF にして
--     shifts_old → shifts への INSERT がスムーズに行えるようにする。
-- ============================================================

-- 外部キー制約を一時無効化（テーブルコピー中の参照エラーを防ぐ）
PRAGMA foreign_keys = OFF;

-- ============================================================
-- Step 1: shifts テーブルを再作成して FK を追加
--   (SQLite は ALTER TABLE ADD CONSTRAINT をサポートしないため
--    RENAME → CREATE → INSERT → DROP の手順が必要)
-- ============================================================

ALTER TABLE shifts RENAME TO shifts_old;

CREATE TABLE shifts (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    staffId TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    classType TEXT NOT NULL,
    isEarlyShift INTEGER DEFAULT 0,
    isError INTEGER DEFAULT 0,
    duty_number INTEGER DEFAULT NULL,
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

INSERT INTO shifts SELECT * FROM shifts_old;

DROP TABLE shifts_old;

-- shifts に付随するインデックスを再作成（DROP TABLE で消えるため）
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staffId, date);
-- duty_number は NULL 可で NULL は重複許容のため部分インデックスで保護
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_date_duty_number ON shifts(date, duty_number) WHERE duty_number IS NOT NULL;

-- ============================================================
-- Step 2: staffs.access_key の UNIQUE INDEX 追加
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_staffs_access_key ON staffs(access_key) WHERE access_key IS NOT NULL;

-- 外部キー制約を再有効化
PRAGMA foreign_keys = ON;
