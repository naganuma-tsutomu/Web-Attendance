-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    auto_allocate INTEGER DEFAULT 1, -- 1: ON, 0: OFF
    color TEXT DEFAULT '#818cf8'
);



-- Staffs Table
CREATE TABLE IF NOT EXISTS staffs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    hoursTarget REAL,
    weeklyHoursTarget REAL,
    isHelpStaff INTEGER DEFAULT 0, -- Boolean 0 or 1
    defaultWorkingHoursStart TEXT,
    defaultWorkingHoursEnd TEXT,
    display_order INTEGER DEFAULT 0,
    access_key TEXT
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
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
);

-- shift_preference_dates Table (Normalized)
CREATE TABLE IF NOT EXISTS shift_preference_dates (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL,
    date TEXT NOT NULL, -- "YYYY-MM-DD"
    startTime TEXT,     -- "HH:MM" or NULL (NULL means full day unavailable)
    endTime TEXT,       -- "HH:MM" or NULL
    type TEXT,          -- "training" or NULL
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
    isError INTEGER DEFAULT 0,
    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE,
    FOREIGN KEY(classType) REFERENCES classes(id) ON DELETE CASCADE
);

-- Fixed Dates (Locked shifts) Table
CREATE TABLE IF NOT EXISTS fixed_dates (
    date TEXT PRIMARY KEY,
    yearMonth TEXT NOT NULL -- e.g. "2024-04"
);

-- ======================================================
-- 新設計: 勤務時間パターン + 役職のDB管理
-- ======================================================

-- 勤務時間パターン (役職に関係なく定義する時間パターン)
CREATE TABLE IF NOT EXISTS shift_time_patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,       -- 例: "早番", "遅番", "中番"
    startTime TEXT NOT NULL,  -- "HH:MM"
    endTime TEXT NOT NULL,    -- "HH:MM"
    display_order INTEGER DEFAULT 0,
    sun INTEGER DEFAULT 1,
    mon INTEGER DEFAULT 1,
    tue INTEGER DEFAULT 1,
    wed INTEGER DEFAULT 1,
    thu INTEGER DEFAULT 1,
    fri INTEGER DEFAULT 1,
    sat INTEGER DEFAULT 1,
    holiday INTEGER DEFAULT 1
);

-- 役職マスタ (自由に追加・削除可能)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,  -- 例: "正社員", "短時間パートA"
    targetHours REAL DEFAULT 0, -- 月間目標時間
    weeklyHoursTarget REAL, -- 週間目標時間
    display_order INTEGER DEFAULT 0
);

-- 役職とパターンの中間テーブル (役職に使えるパターンを紐付ける)
CREATE TABLE IF NOT EXISTS role_patterns (
    roleId TEXT NOT NULL,
    patternId TEXT NOT NULL,
    PRIMARY KEY (roleId, patternId),
    FOREIGN KEY(roleId) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY(patternId) REFERENCES shift_time_patterns(id) ON DELETE CASCADE
);



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

-- シフト・希望休検索用インデックス
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staffId, date);
CREATE INDEX IF NOT EXISTS idx_shift_pref_dates_ym ON shift_preference_dates(yearMonth);
CREATE INDEX IF NOT EXISTS idx_staff_available_days_staffid ON staff_available_days(staffId);
CREATE INDEX IF NOT EXISTS idx_shift_preferences_staffid_ym ON shift_preferences(staffId, yearMonth);

