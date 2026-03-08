-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    auto_allocate INTEGER DEFAULT 1 -- 1: ON, 0: OFF
);

-- Initial Class Data
INSERT OR IGNORE INTO classes (id, name, display_order) VALUES ('class_niji', '虹組', 1);
INSERT OR IGNORE INTO classes (id, name, display_order) VALUES ('class_smile', 'スマイル組', 2);
INSERT OR IGNORE INTO classes (id, name, display_order) VALUES ('class_special', '特殊', 3);

-- Staffs Table
CREATE TABLE IF NOT EXISTS staffs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    hoursTarget INTEGER,
    availableDays TEXT, -- JSON array string (Lgegacy, will be replaced by staff_available_days)
    isHelpStaff INTEGER DEFAULT 0, -- Boolean 0 or 1
    defaultWorkingHoursStart TEXT,
    defaultWorkingHoursEnd TEXT,
    display_order INTEGER DEFAULT 0
);

-- Staff Classes (Many-to-Many)
CREATE TABLE IF NOT EXISTS staff_classes (
    staffId TEXT NOT NULL,
    classId TEXT NOT NULL,
    PRIMARY KEY (staffId, classId),
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE,
    FOREIGN KEY(classId) REFERENCES classes(id) ON DELETE CASCADE
);

-- staff_available_days Table (Normalized)
CREATE TABLE IF NOT EXISTS staff_available_days (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL, -- 0:日, 1:月, ..., 6:土
    weeks TEXT, -- JSON array string e.g. "[1,3,5]" (NULL means all weeks)
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

-- Shift Preferences Table
CREATE TABLE IF NOT EXISTS shift_preferences (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL, -- e.g. "2024-04"
    unavailableDates TEXT NOT NULL, -- JSON array string (Legacy, will be replaced by shift_preference_dates)
    FOREIGN KEY(staffId) REFERENCES staffs(id)
);

-- shift_preference_dates Table (Normalized)
CREATE TABLE IF NOT EXISTS shift_preference_dates (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL,
    date TEXT NOT NULL, -- "YYYY-MM-DD"
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

-- Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL, -- "YYYY-MM-DD"
    staffId TEXT NOT NULL,
    startTime TEXT NOT NULL, -- "HH:MM"
    endTime TEXT NOT NULL, -- "HH:MM"
    classType TEXT NOT NULL,
    isEarlyShift INTEGER DEFAULT 0,
    isError INTEGER DEFAULT 0
);

-- ======================================================
-- 新設計: 勤務時間パターン + 役職のDB管理
-- ======================================================

-- 勤務時間パターン (役職に関係なく定義する時間パターン)
CREATE TABLE IF NOT EXISTS shift_time_patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,       -- 例: "早番", "遅番", "中番"
    startTime TEXT NOT NULL,  -- "HH:MM"
    endTime TEXT NOT NULL     -- "HH:MM"
);

-- 役職マスタ (自由に追加・削除可能)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,  -- 例: "正社員", "短時間パートA"
    targetHours INTEGER DEFAULT 0 -- 月間目標時間
);

-- 役職とパターンの中間テーブル (役職に使えるパターンを紐付ける)
CREATE TABLE IF NOT EXISTS role_patterns (
    roleId TEXT NOT NULL,
    patternId TEXT NOT NULL,
    PRIMARY KEY (roleId, patternId),
    FOREIGN KEY(roleId) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY(patternId) REFERENCES shift_time_patterns(id) ON DELETE CASCADE
);

-- 初期データ: 標準的な役職
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_full', '正社員');
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_semi', '準社員');
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_part', 'パート');
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_special', '特殊スタッフ');

-- 初期データ: 標準的な勤務時間パターン
INSERT OR IGNORE INTO shift_time_patterns (id, name, startTime, endTime) VALUES ('stp_early', '早番', '09:00', '17:00');
INSERT OR IGNORE INTO shift_time_patterns (id, name, startTime, endTime) VALUES ('stp_late', '遅番', '12:00', '20:00');
INSERT OR IGNORE INTO shift_time_patterns (id, name, startTime, endTime) VALUES ('stp_short', '短時間', '10:00', '15:00');

-- 廃止: role_settings, shift_patterns (既に存在する場合は残しても無害)
-- DROP TABLE IF EXISTS role_settings;
-- DROP TABLE IF EXISTS shift_patterns;

-- ======================================================
-- シフト要件管理テーブル
-- ======================================================

-- Shift Requirements Table
CREATE TABLE IF NOT EXISTS shift_requirements (
    id TEXT PRIMARY KEY,
    classId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    minStaffCount INTEGER NOT NULL DEFAULT 1,
    maxStaffCount INTEGER,
    priority INTEGER DEFAULT 0,
    FOREIGN KEY(classId) REFERENCES classes(id) ON DELETE CASCADE
);

-- Initial sample data (optional)
-- Example: Niji class needs 2 staff on weekdays 9:00-12:00
INSERT OR IGNORE INTO shift_requirements (id, classId, dayOfWeek, startTime, endTime, minStaffCount, priority)
VALUES ('req_001', 'class_niji', 1, '09:00', '12:00', 2, 1);

-- ======================================================
-- 祝日管理テーブル
-- ======================================================

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

-- 初期データ: 2025年-2026年の祝日
INSERT OR IGNORE INTO holidays (id, date, name, type, is_workday) VALUES
('hol_2025_01', '2025-01-01', '元日', 'national', 0),
('hol_2025_02', '2025-01-13', '成人の日', 'national', 0),
('hol_2025_03', '2025-02-11', '建国記念の日', 'national', 0),
('hol_2025_04', '2025-02-23', '天皇誕生日', 'national', 0),
('hol_2025_05', '2025-02-24', '天皇誕生日 振替休日', 'national', 0),
('hol_2025_06', '2025-03-20', '春分の日', 'national', 0),
('hol_2025_12', '2025-07-21', '海の日', 'national', 0),
('hol_2025_13', '2025-08-11', '山の日', 'national', 0),
('hol_2025_14', '2025-09-15', '敬老の日', 'national', 0),
('hol_2025_15', '2025-09-23', '秋分の日', 'national', 0),
('hol_2025_16', '2025-10-13', 'スポーツの日', 'national', 0),
('hol_2025_17', '2025-11-03', '文化の日', 'national', 0),
('hol_2025_18', '2025-11-23', '勤労感謝の日', 'national', 0),
('hol_2025_19', '2025-11-24', '勤労感謝の日 振替休日', 'national', 0),
('hol_2026_01', '2026-01-01', '元日', 'national', 0),
('hol_2026_02', '2026-01-12', '成人の日', 'national', 0),
('hol_2026_03', '2026-02-11', '建国記念の日', 'national', 0),
('hol_2026_04', '2026-02-23', '天皇誕生日', 'national', 0),
('hol_2026_05', '2026-03-20', '春分の日', 'national', 0),
('hol_2026_11', '2026-07-20', '海の日', 'national', 0),
('hol_2026_12', '2026-08-11', '山の日', 'national', 0),
('hol_2026_13', '2026-09-21', '敬老の日', 'national', 0),
('hol_2026_14', '2026-09-22', '国民の休日', 'national', 0),
('hol_2026_15', '2026-09-23', '秋分の日', 'national', 0),
('hol_2026_16', '2026-10-12', 'スポーツの日', 'national', 0),
('hol_2026_17', '2026-11-03', '文化の日', 'national', 0),
('hol_2026_18', '2026-11-23', '勤労感謝の日', 'national', 0);
