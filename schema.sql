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
