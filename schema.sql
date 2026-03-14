-- Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    auto_allocate INTEGER DEFAULT 1 -- 1: ON, 0: OFF
);



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
    targetHours INTEGER DEFAULT 0, -- 月間目標時間
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


PRAGMA defer_foreign_keys=TRUE;
INSERT INTO "classes" ("id","name","display_order","auto_allocate") VALUES('class_niji','虹組',0,1);
INSERT INTO "classes" ("id","name","display_order","auto_allocate") VALUES('class_smile','スマイル組',1,1);
INSERT INTO "classes" ("id","name","display_order","auto_allocate") VALUES('class_special','ヘルプ',2,0);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772904338091','正社員1','正社員',NULL,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',0,NULL,NULL,1);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772904349897','正社員2','正社員',NULL,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',0,NULL,NULL,2);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772904364146','パート1','パート',100,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',0,NULL,NULL,5);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772904396793','準社員1','準社員',135,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',0,NULL,NULL,4);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772939143605','パート2','パート',100,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',1,NULL,NULL,6);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772969329254','パート3','パート',100,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',0,NULL,NULL,7);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772969335436','パート4','パート',100,'[1,2,3,4,5,6]',0,NULL,NULL,8);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772969343268','パート5','パート',30,'[{"day":1},{"day":2},{"day":3},{"day":4},{"day":5},{"day":6}]',0,NULL,NULL,9);
INSERT INTO "staffs" ("id","name","role","hoursTarget","availableDays","isHelpStaff","defaultWorkingHoursStart","defaultWorkingHoursEnd","display_order") VALUES('staff_1772985694703','正社員3','正社員',NULL,'[1,2,3,4,5,6]',0,NULL,NULL,3);
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772969335436','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772969335436','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772939143605','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772939143605','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772969329254','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772969329254','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772985694703','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772985694703','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904338091','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904338091','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904349897','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904349897','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904396793','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904396793','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904364146','class_niji');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772904364146','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772969343268','class_smile');
INSERT INTO "staff_classes" ("staffId","classId") VALUES('staff_1772969343268','class_niji');
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969335436_available_0','staff_1772969335436',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969335436_available_1','staff_1772969335436',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969335436_available_2','staff_1772969335436',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969335436_available_3','staff_1772969335436',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969335436_available_4','staff_1772969335436',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969335436_available_5','staff_1772969335436',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772939143605_available_1772969350764_0','staff_1772939143605',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772939143605_available_1772969350764_1','staff_1772939143605',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772939143605_available_1772969350764_2','staff_1772939143605',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772939143605_available_1772969350764_3','staff_1772939143605',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772939143605_available_1772969350764_4','staff_1772939143605',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772939143605_available_1772969350764_5','staff_1772939143605',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969329254_available_1772969353274_0','staff_1772969329254',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969329254_available_1772969353274_1','staff_1772969329254',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969329254_available_1772969353274_2','staff_1772969329254',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969329254_available_1772969353274_3','staff_1772969329254',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969329254_available_1772969353274_4','staff_1772969329254',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969329254_available_1772969353274_5','staff_1772969329254',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772985694703_available_0','staff_1772985694703',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772985694703_available_1','staff_1772985694703',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772985694703_available_2','staff_1772985694703',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772985694703_available_3','staff_1772985694703',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772985694703_available_4','staff_1772985694703',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772985694703_available_5','staff_1772985694703',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904338091_available_1772985709281_0','staff_1772904338091',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904338091_available_1772985709281_1','staff_1772904338091',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904338091_available_1772985709281_2','staff_1772904338091',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904338091_available_1772985709281_3','staff_1772904338091',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904338091_available_1772985709281_4','staff_1772904338091',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904338091_available_1772985709281_5','staff_1772904338091',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904349897_available_1772985714466_0','staff_1772904349897',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904349897_available_1772985714466_1','staff_1772904349897',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904349897_available_1772985714466_2','staff_1772904349897',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904349897_available_1772985714466_3','staff_1772904349897',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904349897_available_1772985714466_4','staff_1772904349897',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904349897_available_1772985714466_5','staff_1772904349897',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904396793_available_1772985735474_0','staff_1772904396793',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904396793_available_1772985735474_1','staff_1772904396793',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904396793_available_1772985735474_2','staff_1772904396793',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904396793_available_1772985735474_3','staff_1772904396793',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904396793_available_1772985735474_4','staff_1772904396793',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904396793_available_1772985735474_5','staff_1772904396793',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904364146_available_1772985747512_0','staff_1772904364146',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904364146_available_1772985747512_1','staff_1772904364146',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904364146_available_1772985747512_2','staff_1772904364146',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904364146_available_1772985747512_3','staff_1772904364146',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904364146_available_1772985747512_4','staff_1772904364146',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772904364146_available_1772985747512_5','staff_1772904364146',6,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969343268_available_1772985755379_0','staff_1772969343268',1,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969343268_available_1772985755379_1','staff_1772969343268',2,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969343268_available_1772985755379_2','staff_1772969343268',3,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969343268_available_1772985755379_3','staff_1772969343268',4,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969343268_available_1772985755379_4','staff_1772969343268',5,NULL);
INSERT INTO "staff_available_days" ("id","staffId","dayOfWeek","weeks") VALUES('staff_1772969343268_available_1772985755379_5','staff_1772969343268',6,NULL);
INSERT INTO "shift_preferences" ("id","staffId","yearMonth","unavailableDates") VALUES('pref_1772945719798','staff_1772904338091','2026-04','["2026-04-03","2026-04-10","2026-04-17","2026-04-24"]');
INSERT INTO "shift_preference_dates" ("id","staffId","yearMonth","date") VALUES('prefd_staff_1772904338091_2026-04-03_0','staff_1772904338091','2026-04','2026-04-03');
INSERT INTO "shift_preference_dates" ("id","staffId","yearMonth","date") VALUES('prefd_staff_1772904338091_2026-04-10_1','staff_1772904338091','2026-04','2026-04-10');
INSERT INTO "shift_preference_dates" ("id","staffId","yearMonth","date") VALUES('prefd_staff_1772904338091_2026-04-17_2','staff_1772904338091','2026-04','2026-04-17');
INSERT INTO "shift_preference_dates" ("id","staffId","yearMonth","date") VALUES('prefd_staff_1772904338091_2026-04-24_3','staff_1772904338091','2026-04','2026-04-24');
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_0','2026-04-01','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_1','2026-04-01','staff_1772904364146','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_2','2026-04-01','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_3','2026-04-01','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_4','2026-04-01','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_5','2026-04-01','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_6','2026-04-02','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_7','2026-04-02','staff_1772969335436','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_8','2026-04-02','staff_1772969343268','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_9','2026-04-02','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_10','2026-04-02','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_11','2026-04-02','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_12','2026-04-03','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_13','2026-04-03','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_14','2026-04-03','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_15','2026-04-03','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_16','2026-04-03','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_17','2026-04-03','staff_1772969343268','13:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_18','2026-04-04','staff_1772904338091','08:00','16:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_19','2026-04-04','staff_1772904349897','08:00','16:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_20','2026-04-06','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_21','2026-04-06','staff_1772969343268','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_22','2026-04-06','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_23','2026-04-06','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_24','2026-04-06','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_25','2026-04-06','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_26','2026-04-07','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_27','2026-04-07','staff_1772969329254','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_28','2026-04-07','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_29','2026-04-07','staff_1772969343268','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_30','2026-04-07','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_31','2026-04-07','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_32','2026-04-08','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_33','2026-04-08','staff_1772904364146','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_34','2026-04-08','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_35','2026-04-08','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_36','2026-04-08','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_37','2026-04-08','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_38','2026-04-09','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_39','2026-04-09','staff_1772969335436','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_40','2026-04-09','staff_1772969343268','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_41','2026-04-09','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_42','2026-04-09','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_43','2026-04-09','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_44','2026-04-10','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_45','2026-04-10','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_46','2026-04-10','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_47','2026-04-10','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_48','2026-04-10','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_49','2026-04-10','staff_1772904364146','13:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_50','2026-04-11','staff_1772904338091','08:00','16:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_51','2026-04-11','staff_1772985694703','08:00','16:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_52','2026-04-13','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_53','2026-04-13','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_54','2026-04-13','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_55','2026-04-13','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_56','2026-04-13','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_57','2026-04-13','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_58','2026-04-14','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_59','2026-04-14','staff_1772904364146','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_60','2026-04-14','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_61','2026-04-14','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_62','2026-04-14','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_63','2026-04-14','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_64','2026-04-15','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_65','2026-04-15','staff_1772969335436','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_66','2026-04-15','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_67','2026-04-15','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_68','2026-04-15','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_69','2026-04-15','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_70','2026-04-16','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_71','2026-04-16','staff_1772969329254','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_72','2026-04-16','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_73','2026-04-16','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_74','2026-04-16','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_75','2026-04-16','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_76','2026-04-17','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_77','2026-04-17','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_78','2026-04-17','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_79','2026-04-17','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_80','2026-04-17','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_81','2026-04-17','staff_1772904364146','13:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_82','2026-04-18','staff_1772904338091','08:00','16:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_83','2026-04-18','staff_1772904349897','08:00','16:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_84','2026-04-20','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_85','2026-04-20','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_86','2026-04-20','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_87','2026-04-20','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_88','2026-04-20','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_89','2026-04-20','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_90','2026-04-21','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_91','2026-04-21','staff_1772904364146','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_92','2026-04-21','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_93','2026-04-21','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_94','2026-04-21','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_95','2026-04-21','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_96','2026-04-22','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_97','2026-04-22','staff_1772969335436','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_98','2026-04-22','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147478_99','2026-04-22','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_100','2026-04-22','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_101','2026-04-22','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_102','2026-04-23','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_103','2026-04-23','staff_1772969329254','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_104','2026-04-23','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_105','2026-04-23','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_106','2026-04-23','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_107','2026-04-23','staff_1772904349897','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_108','2026-04-24','staff_1772985694703','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_109','2026-04-24','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_110','2026-04-24','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_111','2026-04-24','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_112','2026-04-24','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_113','2026-04-24','staff_1772904364146','13:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_114','2026-04-25','staff_1772904338091','08:00','16:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_115','2026-04-25','staff_1772985694703','08:00','16:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_116','2026-04-27','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_117','2026-04-27','staff_1772939143605','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_118','2026-04-27','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_119','2026-04-27','staff_1772969335436','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_120','2026-04-27','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_121','2026-04-27','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_122','2026-04-28','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_123','2026-04-28','staff_1772904364146','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_124','2026-04-28','staff_1772939143605','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_125','2026-04-28','staff_1772969329254','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_126','2026-04-28','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_127','2026-04-28','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_128','2026-04-30','staff_1772904338091','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_129','2026-04-30','staff_1772969335436','12:00','18:45','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_130','2026-04-30','staff_1772904364146','12:00','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_131','2026-04-30','staff_1772904396793','11:15','18:45','class_smile',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_132','2026-04-30','staff_1772904349897','09:00','18:00','class_niji',1,0);
INSERT INTO "shifts" ("id","date","staffId","startTime","endTime","classType","isEarlyShift","isError") VALUES('shift_1773024147508_133','2026-04-30','staff_1772985694703','09:00','18:00','class_smile',1,0);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_short','パート3','12:00','18:45',7,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772968058491_yikod','パート 1','13:00','18:45',5,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772968348888_o2fm5','正社員 土曜','08:00','16:00',0,0,0,0,0,0,0,1,0);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772968367035_0eoun','正社員 遅番','09:00','18:00',1,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772968480406_yntwk','正社員 早番','10:15','18:00',2,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772968513450_29lbf','準社員 1','11:15','18:45',3,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772968868116_2knfq','準社員 2','12:00','18:00',4,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772969009425_i19kh','パート2','13:00','18:45',6,1,1,1,1,1,1,1,1);
INSERT INTO "shift_time_patterns" ("id","name","startTime","endTime","display_order","sun","mon","tue","wed","thu","fri","sat","holiday") VALUES('stp_1772969201587_w8yd3','パート4','10:30','16:00',8,1,1,1,1,1,1,1,1);
INSERT INTO "roles" ("id","name","targetHours","display_order") VALUES('role_full','正社員',NULL,1);
INSERT INTO "roles" ("id","name","targetHours","display_order") VALUES('role_semi','準社員',130,3);
INSERT INTO "roles" ("id","name","targetHours","display_order") VALUES('role_part','パート',100,2);
INSERT INTO "roles" ("id","name","targetHours","display_order") VALUES('role_special','特殊スタッフ',NULL,4);
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_full','stp_1772968367035_0eoun');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_full','stp_1772968480406_yntwk');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_semi','stp_1772968513450_29lbf');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_semi','stp_1772968868116_2knfq');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_part','stp_short');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_part','stp_1772968058491_yikod');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_part','stp_1772969009425_i19kh');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_part','stp_1772969201587_w8yd3');
INSERT INTO "role_patterns" ("roleId","patternId") VALUES('role_full','stp_1772968348888_o2fm5');
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_1772985358539_a4phb','class_niji',6,'08:00','16:00',1,NULL,5);
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_1772985358539_s359c','class_smile',6,'08:00','16:00',1,NULL,5);
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_001','class_niji',7,'10:15','10:30',1,NULL,5);
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_1772985358539_5kpyt','class_niji',7,'12:00','18:45',2,NULL,5);
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_1772985358539_dp1o0','class_smile',7,'12:00','18:45',2,NULL,3);
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_1772985358539_fh9h1','class_niji',7,'13:00','14:00',3,NULL,3);
INSERT INTO "shift_requirements" ("id","classId","dayOfWeek","startTime","endTime","minStaffCount","maxStaffCount","priority") VALUES('req_1772985358539_o86bx','class_smile',7,'13:00','14:00',3,NULL,3);
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_01','2025-01-01','元日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_02','2025-01-13','成人の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_03','2025-02-11','建国記念の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_04','2025-02-23','天皇誕生日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_05','2025-02-24','天皇誕生日 振替休日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_06','2025-03-20','春分の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_12','2025-07-21','海の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_13','2025-08-11','山の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_14','2025-09-15','敬老の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_15','2025-09-23','秋分の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_16','2025-10-13','スポーツの日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_17','2025-11-03','文化の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_18','2025-11-23','勤労感謝の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2025_19','2025-11-24','勤労感謝の日 振替休日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_01','2026-01-01','元日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_02','2026-01-12','成人の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_03','2026-02-11','建国記念の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_04','2026-02-23','天皇誕生日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_05','2026-03-20','春分の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_11','2026-07-20','海の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_12','2026-08-11','山の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_13','2026-09-21','敬老の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_14','2026-09-22','国民の休日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_15','2026-09-23','秋分の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_16','2026-10-12','スポーツの日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_17','2026-11-03','文化の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_18','2026-11-23','勤労感謝の日','national',0,'2026-03-08 11:05:15','2026-03-08 11:05:15');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_20260429','2026-04-29','昭和の日','national',0,'2026-03-08 11:06:24','2026-03-08 11:06:24');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_20260503','2026-05-03','憲法記念日','national',0,'2026-03-08 11:06:24','2026-03-08 11:06:24');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_20260504','2026-05-04','みどりの日','national',0,'2026-03-08 11:06:24','2026-03-08 11:06:24');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_20260505','2026-05-05','こどもの日','national',0,'2026-03-08 11:06:24','2026-03-08 11:06:24');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2026_20260506','2026-05-06','こどもの日 振替休日','national',0,'2026-03-08 11:06:24','2026-03-08 11:06:24');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270101','2027-01-01','元日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270111','2027-01-11','成人の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270211','2027-02-11','建国記念の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270223','2027-02-23','天皇誕生日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270321','2027-03-21','春分の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270322','2027-03-22','春分の日 振替休日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270429','2027-04-29','昭和の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270503','2027-05-03','憲法記念日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270504','2027-05-04','みどりの日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270505','2027-05-05','こどもの日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270719','2027-07-19','海の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270811','2027-08-11','山の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270920','2027-09-20','敬老の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20270923','2027-09-23','秋分の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20271011','2027-10-11','スポーツの日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20271103','2027-11-03','文化の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
INSERT INTO "holidays" ("id","date","name","type","is_workday","created_at","updated_at") VALUES('hol_2027_20271123','2027-11-23','勤労感謝の日','national',0,'2026-03-08 11:06:25','2026-03-08 11:06:25');
