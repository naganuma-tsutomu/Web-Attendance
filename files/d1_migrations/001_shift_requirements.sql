-- shift_requirements テーブル (D1/SQLite用)
-- PostgreSQL版から変換: UUID→TEXT, TIMESTAMPTZ→TEXT, トリガー/RLSはアプリレベルで実装

CREATE TABLE IF NOT EXISTS shift_requirements (
    id TEXT PRIMARY KEY,  -- UUIDをTEXTで保存 (アプリ側で生成)
    class_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 7),
    start_time TEXT NOT NULL,  -- HH:MM形式
    end_time TEXT NOT NULL,    -- HH:MM形式
    min_staff_count INTEGER NOT NULL CHECK (min_staff_count >= 0),
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 5),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shift_requirements_class_id ON shift_requirements(class_id);
CREATE INDEX IF NOT EXISTS idx_shift_requirements_day_of_week ON shift_requirements(day_of_week);

-- 注意: D1/SQLiteではトリガーによるupdated_at自動更新はサポートされていない
-- アプリケーションレベルでUPDATE時にupdated_atを更新すること

-- 注意: RLS (Row Level Security) はD1では非対応
-- アプリケーションレベルで認証・認可を実装すること
