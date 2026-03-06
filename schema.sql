-- Staffs Table
CREATE TABLE IF NOT EXISTS staffs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    hoursTarget INTEGER,
    availableDays TEXT, -- JSON array string
    isHelpStaff INTEGER DEFAULT 0, -- Boolean 0 or 1
    defaultWorkingHoursStart TEXT,
    defaultWorkingHoursEnd TEXT
);

-- Shift Preferences Table
CREATE TABLE IF NOT EXISTS shift_preferences (
    id TEXT PRIMARY KEY,
    staffId TEXT NOT NULL,
    yearMonth TEXT NOT NULL, -- e.g. "2024-04"
    unavailableDates TEXT NOT NULL, -- JSON array string of dates "YYYY-MM-DD"
    FOREIGN KEY(staffId) REFERENCES staffs(id)
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

-- Role Settings Table (Base working hours per role)
CREATE TABLE IF NOT EXISTS role_settings (
    role TEXT PRIMARY KEY,
    defaultStartTime TEXT NOT NULL, -- "HH:MM"
    defaultEndTime TEXT NOT NULL   -- "HH:MM"
);

-- Insert initial records for roles
INSERT OR IGNORE INTO role_settings (role, defaultStartTime, defaultEndTime) VALUES ('正社員', '09:00', '18:00');
INSERT OR IGNORE INTO role_settings (role, defaultStartTime, defaultEndTime) VALUES ('準社員', '09:00', '17:00');
INSERT OR IGNORE INTO role_settings (role, defaultStartTime, defaultEndTime) VALUES ('パート', '10:00', '16:00');
INSERT OR IGNORE INTO role_settings (role, defaultStartTime, defaultEndTime) VALUES ('特殊スタッフ', '13:00', '17:00');
