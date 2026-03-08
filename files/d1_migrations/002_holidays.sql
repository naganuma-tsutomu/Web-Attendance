-- holidays テーブル (D1/SQLite用)
-- 2025年・2026年の祝日データを含む

CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,      -- YYYY-MM-DD形式
    name TEXT NOT NULL,              -- 祝日名
    type TEXT NOT NULL,              -- 'national', 'observance', 'company'等
    is_workday INTEGER DEFAULT 0,    -- 振替休日など特別対応用 (0: 休日, 1: 出勤日)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 日付検索用インデックス
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(type);
CREATE INDEX IF NOT EXISTS idx_holidays_date_type ON holidays(date, type);

-- 初期データ: 2025年の祝日
INSERT OR IGNORE INTO holidays (id, date, name, type, is_workday) VALUES
('hol_2025_001', '2025-01-01', '元日', 'national', 0),
('hol_2025_002', '2025-01-13', '成人の日', 'national', 0),
('hol_2025_003', '2025-02-11', '建国記念の日', 'national', 0),
('hol_2025_004', '2025-02-23', '天皇誕生日', 'national', 0),
('hol_2025_005', '2025-02-24', '天皇誕生日 振替休日', 'national', 0),
('hol_2025_006', '2025-03-20', '春分の日', 'national', 0),
('hol_2025_007', '2025-04-29', '昭和の日', 'national', 0),
('hol_2025_008', '2025-05-03', '憲法記念日', 'national', 0),
('hol_2025_009', '2025-05-04', 'みどりの日', 'national', 0),
('hol_2025_010', '2025-05-05', 'こどもの日', 'national', 0),
('hol_2025_011', '2025-05-06', 'こどもの日 振替休日', 'national', 0),
('hol_2025_012', '2025-07-21', '海の日', 'national', 0),
('hol_2025_013', '2025-08-11', '山の日', 'national', 0),
('hol_2025_014', '2025-09-15', '敬老の日', 'national', 0),
('hol_2025_015', '2025-09-23', '秋分の日', 'national', 0),
('hol_2025_016', '2025-10-13', 'スポーツの日', 'national', 0),
('hol_2025_017', '2025-11-03', '文化の日', 'national', 0),
('hol_2025_018', '2025-11-23', '勤労感謝の日', 'national', 0),
('hol_2025_019', '2025-11-24', '勤労感謝の日 振替休日', 'national', 0);

-- 初期データ: 2026年の祝日
INSERT OR IGNORE INTO holidays (id, date, name, type, is_workday) VALUES
('hol_2026_001', '2026-01-01', '元日', 'national', 0),
('hol_2026_002', '2026-01-12', '成人の日', 'national', 0),
('hol_2026_003', '2026-02-11', '建国記念の日', 'national', 0),
('hol_2026_004', '2026-02-23', '天皇誕生日', 'national', 0),
('hol_2026_005', '2026-03-20', '春分の日', 'national', 0),
('hol_2026_006', '2026-04-29', '昭和の日', 'national', 0),
('hol_2026_007', '2026-05-03', '憲法記念日', 'national', 0),
('hol_2026_008', '2026-05-04', 'みどりの日', 'national', 0),
('hol_2026_009', '2026-05-05', 'こどもの日', 'national', 0),
('hol_2026_010', '2026-05-06', '憲法記念日 振替休日', 'national', 0),
('hol_2026_011', '2026-07-20', '海の日', 'national', 0),
('hol_2026_012', '2026-08-11', '山の日', 'national', 0),
('hol_2026_013', '2026-09-21', '敬老の日', 'national', 0),
('hol_2026_014', '2026-09-22', '国民の休日', 'national', 0),
('hol_2026_015', '2026-09-23', '秋分の日', 'national', 0),
('hol_2026_016', '2026-10-12', 'スポーツの日', 'national', 0),
('hol_2026_017', '2026-11-03', '文化の日', 'national', 0),
('hol_2026_018', '2026-11-23', '勤労感謝の日', 'national', 0);

-- 注意: RLS (Row Level Security) はD1では非対応
-- アプリケーションレベルで認証・認可を実装すること
