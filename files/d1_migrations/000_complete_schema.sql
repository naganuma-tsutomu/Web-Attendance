-- ======================================================
-- Web-Attendance D1 Database Complete Schema
-- 作成日: 2025年
-- 対象: Cloudflare D1 (SQLite)
-- ======================================================

-- ======================================================
-- 1. classes - クラス管理（虹組/スマイル組等）
-- ======================================================
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    auto_allocate INTEGER DEFAULT 1 -- 1: ON, 0: OFF
);

-- 初期データ: 標準クラス
INSERT OR IGNORE INTO classes (id, name, display_order) VALUES ('class_niji', '虹組', 1);
INSERT OR IGNORE INTO classes (id, name, display_order) VALUES ('class_smile', 'スマイル組', 2);
INSERT OR IGNORE INTO classes (id, name, display_order) VALUES ('class_special', '特殊', 3);

-- ======================================================
-- 2. staffs - スタッフ管理
-- ======================================================
CREATE TABLE IF NOT EXISTS staffs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    hoursTarget INTEGER,
    availableDays TEXT, -- JSON array string (Legacy)
    isHelpStaff INTEGER DEFAULT 0, -- Boolean 0 or 1
    defaultWorkingHoursStart TEXT,
    defaultWorkingHoursEnd TEXT,
    display_order INTEGER DEFAULT 0
);

-- ======================================================
-- 3. staff_classes - スタッフとクラスの中間テーブル（多対多）
-- ======================================================
CREATE TABLE IF NOT EXISTS staff_classes (
    staffId TEXT NOT NULL,
    classId TEXT NOT NULL,
    PRIMARY KEY (staffId, classId),
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE,
    FOREIGN KEY(classId) REFERENCES classes(id) ON DELETE CASCADE
);

-- ======================================================
-- 4. staff_available_days - スタッフの勤務可能日（正規化）
-- ======================================================
CREATE TABLE IF NOT EXISTS staff_available_days (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    dayOfWeek INTEGER NOT NULL, -- 0:日, 1:月, ..., 6:土
    weeks TEXT, -- JSON array string e.g. "[1,3,5]" (NULL means all weeks)
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

-- ======================================================
-- 5. shift_preferences - シフト希望（レガシー）
-- ======================================================
CREATE TABLE IF NOT EXISTS shift_preferences (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL, -- e.g. "2024-04"
    unavailableDates TEXT NOT NULL, -- JSON array string (Legacy)
    FOREIGN KEY(staffId) REFERENCES staffs(id)
);

-- ======================================================
-- 6. shift_preference_dates - シフト希望日（正規化）
-- ======================================================
CREATE TABLE IF NOT EXISTS shift_preference_dates (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL,
    date TEXT NOT NULL, -- "YYYY-MM-DD"
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

-- ======================================================
-- 7. shifts - シフトデータ
-- ======================================================
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
-- 8. shift_time_patterns - 勤務時間パターン
-- ======================================================
CREATE TABLE IF NOT EXISTS shift_time_patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,       -- 例: "早番", "遅番", "中番"
    startTime TEXT NOT NULL,  -- "HH:MM"
    endTime TEXT NOT NULL     -- "HH:MM"
);

-- 初期データ: 標準的な勤務時間パターン
INSERT OR IGNORE INTO shift_time_patterns (id, name, startTime, endTime) VALUES ('stp_early', '早番', '09:00', '17:00');
INSERT OR IGNORE INTO shift_time_patterns (id, name, startTime, endTime) VALUES ('stp_late', '遅番', '12:00', '20:00');
INSERT OR IGNORE INTO shift_time_patterns (id, name, startTime, endTime) VALUES ('stp_short', '短時間', '10:00', '15:00');

-- ======================================================
-- 9. roles - 役職マスタ
-- ======================================================
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,  -- 例: "正社員", "短時間パートA"
    targetHours INTEGER DEFAULT 0 -- 月間目標時間
);

-- 初期データ: 標準的な役職
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_full', '正社員');
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_semi', '準社員');
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_part', 'パート');
INSERT OR IGNORE INTO roles (id, name) VALUES ('role_special', '特殊スタッフ');

-- ======================================================
-- 10. role_patterns - 役職とパターンの中間テーブル
-- ======================================================
CREATE TABLE IF NOT EXISTS role_patterns (
    roleId TEXT NOT NULL,
    patternId TEXT NOT NULL,
    PRIMARY KEY (roleId, patternId),
    FOREIGN KEY(roleId) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY(patternId) REFERENCES shift_time_patterns(id) ON DELETE CASCADE
);

-- ======================================================
-- 11. shift_patterns - シフトパターン（レガシー/互換性用）
-- ======================================================
CREATE TABLE IF NOT EXISTS shift_patterns (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL
);

-- ======================================================
-- 12. shift_requirements - 必要人数設定
-- ======================================================
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

-- 初期データ例（オプション）
INSERT OR IGNORE INTO shift_requirements (id, classId, dayOfWeek, startTime, endTime, minStaffCount, priority)
VALUES ('req_001', 'class_niji', 1, '09:00', '12:00', 2, 1);

-- ======================================================
-- 13. holidays - 祝日データ
-- ======================================================
CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE, -- "YYYY-MM-DD"
    name TEXT NOT NULL,
    type TEXT DEFAULT 'national', -- 'national', 'observance', 'company'
    is_workday INTEGER DEFAULT 0 -- 振替休日等: 1=勤務日, 0=休日
);

-- ======================================================
-- 2025年の祝日データ
-- ======================================================
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
('hol_2025_016', '2025-10-13', '体育の日', 'national', 0),
('hol_2025_017', '2025-11-03', '文化の日', 'national', 0),
('hol_2025_018', '2025-11-23', '勤労感謝の日', 'national', 0),
('hol_2025_019', '2025-11-24', '勤労感謝の日 振替休日', 'national', 0);

-- ======================================================
-- 2026年の祝日データ
-- ======================================================
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
('hol_2026_016', '2026-10-12', '体育の日', 'national', 0),
('hol_2026_017', '2026-11-03', '文化の日', 'national', 0),
('hol_2026_018', '2026-11-23', '勤労感謝の日', 'national', 0);
