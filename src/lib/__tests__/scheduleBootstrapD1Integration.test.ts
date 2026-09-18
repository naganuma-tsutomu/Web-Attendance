import { afterEach, describe, expect, it } from 'vitest';
import { onRequestGet as getScheduleBootstrap } from '../../../functions/api/schedule-bootstrap';
import { ScheduleBootstrapSchema } from '../api/scheduleBootstrapApi';
import { createD1Miniflare } from './miniflareTestUtils';

const ADMIN_PASSWORD = 'schedule-bootstrap-test-secret';

type BootstrapResponse = {
    references: {
        staffs: Array<Record<string, unknown>>;
        classes: Array<Record<string, unknown>>;
    };
    months: Record<string, {
        shifts: { shifts: Array<Record<string, unknown>>; version: number };
        preferences: Array<Record<string, unknown>>;
        fixedDates: string[];
        businessDayOverrides: Array<Record<string, unknown>>;
    }>;
    holidays: Record<string, Array<Record<string, unknown>>>;
};

describe('schedule bootstrap API with D1', () => {
    let miniflare: ReturnType<typeof createD1Miniflare> | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it('参照データと指定月データを欠落なく1レスポンスで返す', async () => {
        miniflare = createD1Miniflare();
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare('CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT, display_order INTEGER, auto_allocate INTEGER DEFAULT 1, color TEXT)'),
            db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT, role TEXT, hoursTarget REAL, weeklyHoursTarget REAL, defaultWorkingHoursStart TEXT, defaultWorkingHoursEnd TEXT, display_order INTEGER, access_key TEXT, retired_at TEXT)'),
            db.prepare('CREATE TABLE staff_classes (staffId TEXT, classId TEXT)'),
            db.prepare('CREATE TABLE staff_available_days (id TEXT PRIMARY KEY, staffId TEXT, dayOfWeek INTEGER, weeks TEXT)'),
            db.prepare('CREATE TABLE shift_time_patterns (id TEXT PRIMARY KEY, name TEXT, startTime TEXT, endTime TEXT, display_order INTEGER, sun INTEGER, mon INTEGER, tue INTEGER, wed INTEGER, thu INTEGER, fri INTEGER, sat INTEGER, holiday INTEGER)'),
            db.prepare('CREATE TABLE roles (id TEXT PRIMARY KEY, name TEXT, targetHours REAL, weeklyHoursTarget REAL, display_order INTEGER)'),
            db.prepare('CREATE TABLE role_patterns (roleId TEXT, patternId TEXT)'),
            db.prepare('CREATE TABLE shift_requirements (id TEXT PRIMARY KEY, classId TEXT, dayOfWeek INTEGER, startTime TEXT, endTime TEXT, minStaffCount INTEGER, maxStaffCount INTEGER, priority INTEGER)'),
            db.prepare('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
            db.prepare('CREATE TABLE shifts (id TEXT PRIMARY KEY, date TEXT, staffId TEXT, startTime TEXT, endTime TEXT, classType TEXT, isEarlyShift INTEGER DEFAULT 0, isError INTEGER DEFAULT 0, duty_number INTEGER)'),
            db.prepare('CREATE TABLE shift_month_versions (year_month TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, lock_token TEXT)'),
            db.prepare('CREATE TABLE shift_preferences (id TEXT PRIMARY KEY, staffId TEXT, yearMonth TEXT, submitted INTEGER)'),
            db.prepare('CREATE TABLE shift_preference_dates (id TEXT PRIMARY KEY, staffId TEXT, yearMonth TEXT, date TEXT, startTime TEXT, endTime TEXT, type TEXT)'),
            db.prepare('CREATE TABLE fixed_dates (date TEXT PRIMARY KEY, yearMonth TEXT)'),
            db.prepare('CREATE TABLE holidays (id TEXT PRIMARY KEY, date TEXT, name TEXT, type TEXT, is_workday INTEGER, created_at TEXT, updated_at TEXT)'),
            db.prepare('CREATE TABLE business_day_overrides (id TEXT PRIMARY KEY, date TEXT, status TEXT, name TEXT, created_at TEXT, updated_at TEXT)'),
        ]);
        await db.batch([
            db.prepare("INSERT INTO classes (id, name, display_order) VALUES ('c1', 'A組', 1)"),
            db.prepare("INSERT INTO staffs (id, name, role, display_order, access_key) VALUES ('s1', '山田', '常勤', 1, '123456')"),
            db.prepare("INSERT INTO staffs (id, name, role, display_order, retired_at) VALUES ('s2', '元スタッフ', 'バイト', 2, '2026-09-01')"),
            db.prepare("INSERT INTO shifts (id, date, staffId, startTime, endTime, classType) VALUES ('shift1', '2026-08-10', 's1', '09:00', '18:00', 'c1')"),
            db.prepare("INSERT INTO shifts (id, date, staffId, startTime, endTime, classType) VALUES ('shift2', '2026-08-11', 's2', '09:00', '18:00', 'c1')"),
            db.prepare("INSERT INTO shift_month_versions (year_month, version) VALUES ('2026-08', 1)"),
            db.prepare("INSERT INTO shift_preferences (id, staffId, yearMonth, submitted) VALUES ('pref1', 's1', '2026-08', 1)"),
            db.prepare("INSERT INTO shift_preference_dates (id, staffId, yearMonth, date) VALUES ('prefdate1', 's1', '2026-08', '2026-08-15')"),
            db.prepare("INSERT INTO fixed_dates (date, yearMonth) VALUES ('2026-08-10', '2026-08')"),
            db.prepare("INSERT INTO holidays (id, date, name, type, is_workday) VALUES ('holiday1', '2026-08-11', '山の日', 'national', 0)"),
            db.prepare("INSERT INTO business_day_overrides (id, date, status, name) VALUES ('override1', '2026-08-12', 'closed', '臨時休業')"),
        ]);
        const request = new Request('https://example.com/api/schedule-bootstrap?month=2026-08');

        const response = await getScheduleBootstrap({
            request,
            env: { DB: db, ADMIN_PASSWORD },
        } as never);
        const rawData: unknown = await response.json();
        expect(ScheduleBootstrapSchema.safeParse(rawData).success).toBe(true);
        const data = rawData as BootstrapResponse;

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(data.references.staffs).toEqual([expect.objectContaining({ id: 's1', name: '山田' })]);
        expect(data.references.classes).toEqual([expect.objectContaining({ id: 'c1', name: 'A組' })]);
        expect(data.months['2026-08'].shifts).toMatchObject({
            version: 1,
            shifts: [
                expect.objectContaining({ id: 'shift1', isEarlyShift: false }),
                expect.objectContaining({ id: 'shift2', staffName: '元スタッフ' }),
            ],
        });
        expect(data.months['2026-08'].preferences).toEqual([
            expect.objectContaining({ id: 'pref1', submitted: true, details: [expect.objectContaining({ date: '2026-08-15' })] }),
        ]);
        expect(data.months['2026-08'].fixedDates).toEqual(['2026-08-10']);
        expect(data.months['2026-08'].businessDayOverrides).toEqual([
            expect.objectContaining({ id: 'override1', status: 'closed' }),
        ]);
        expect(data.holidays['2026']).toEqual([
            expect.objectContaining({ id: 'holiday1', isWorkday: false }),
        ]);
    });

    it.each([
        '',
        '?month=2026-13',
        '?month=2026-08&month=2026-09&month=2026-10&month=2026-11',
    ])('不正な月指定をDB処理前に拒否する: %s', async query => {
        const prepare = () => { throw new Error('DB should not be called'); };
        const response = await getScheduleBootstrap({
            request: new Request(`https://example.com/api/schedule-bootstrap${query}`),
            env: { DB: { prepare }, ADMIN_PASSWORD },
        } as never);

        expect(response.status).toBe(400);
    });
});
