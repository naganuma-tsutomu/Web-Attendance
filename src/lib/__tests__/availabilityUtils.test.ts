import { describe, it, expect } from 'vitest';
import { isStaffFixedHoliday, isStaffAvailableReason, isStaffAvailable } from '../availabilityUtils';
import type { Staff, ShiftPreference } from '../../types';

const makeStaff = (availableDays: Staff['availableDays']): Staff => ({
    id: 'staff-1',
    name: 'テスト',
    role: '正社員',
    hoursTarget: null,
    weeklyHoursTarget: null,
    defaultWorkingHoursStart: null,
    defaultWorkingHoursEnd: null,
    availableDays,
    classIds: [],
    accessKey: null,
});

// 2025-06-02（月曜 = dayOfWeek 1、第1週）
const MON_W1 = new Date('2025-06-02');
// 2025-06-09（月曜 = dayOfWeek 1、第2週）
const MON_W2 = new Date('2025-06-09');
// 2025-06-16（月曜 = dayOfWeek 1、第3週）
const MON_W3 = new Date('2025-06-16');
// 2025-06-01（日曜 = dayOfWeek 0）
const SUN = new Date('2025-06-01');
// 2025-06-07（土曜 = dayOfWeek 6）
const SAT = new Date('2025-06-07');

describe('isStaffFixedHoliday', () => {
    describe('availableDays が空の場合', () => {
        it('日曜日は fixed holiday にならない（空配列）', () => {
            const staff = makeStaff([]);
            expect(isStaffFixedHoliday(staff, SUN)).toBe(false);
        });

        it('月曜日も false を返す（空配列）', () => {
            const staff = makeStaff([]);
            expect(isStaffFixedHoliday(staff, MON_W1)).toBe(false);
        });
    });

    describe('曜日のみ設定（weeks なし）', () => {
        it('設定した曜日は休日にならない', () => {
            const staff = makeStaff([{ day: 1 }]); // 月曜設定
            expect(isStaffFixedHoliday(staff, MON_W1)).toBe(false);
        });

        it('設定していない曜日（日曜以外）は休日になる', () => {
            const staff = makeStaff([{ day: 1 }]); // 月曜のみ
            expect(isStaffFixedHoliday(staff, SAT)).toBe(true);
        });

        it('設定されていない日曜は休日にならない（特別扱い）', () => {
            const staff = makeStaff([{ day: 1 }]); // 月曜のみ
            expect(isStaffFixedHoliday(staff, SUN)).toBe(false);
        });
    });

    describe('隔週（weeks 指定）', () => {
        it('weeks に含まれる週は休日にならない', () => {
            const staff = makeStaff([{ day: 1, weeks: [1, 3] }]); // 第1・3月曜
            expect(isStaffFixedHoliday(staff, MON_W1)).toBe(false);
            expect(isStaffFixedHoliday(staff, MON_W3)).toBe(false);
        });

        it('weeks に含まれない週は休日になる', () => {
            const staff = makeStaff([{ day: 1, weeks: [1, 3] }]); // 第1・3月曜
            expect(isStaffFixedHoliday(staff, MON_W2)).toBe(true);
        });
    });

    describe('祝日と closedDays', () => {
        it('closedDays に 7（祝日）が含まれ、かつ祝日の場合は休日', () => {
            const staff = makeStaff([{ day: 1 }]);
            expect(isStaffFixedHoliday(staff, MON_W1, [7], true)).toBe(true);
        });

        it('祝日でも closedDays に 7 がなければ休日にならない', () => {
            const staff = makeStaff([{ day: 1 }]);
            expect(isStaffFixedHoliday(staff, MON_W1, [], true)).toBe(false);
        });

        it('closedDays に 7 があっても is_nationalHoliday=false なら祝日休にならない', () => {
            const staff = makeStaff([{ day: 1 }]);
            expect(isStaffFixedHoliday(staff, MON_W1, [7], false)).toBe(false);
        });
    });

    describe('number 型 availableDays（旧形式）', () => {
        it('number 型で設定した曜日は休日にならない', () => {
            const staff = makeStaff([1] as Staff['availableDays']); // 月曜
            expect(isStaffFixedHoliday(staff, MON_W1)).toBe(false);
        });

        it('number 型で設定していない曜日は休日になる', () => {
            const staff = makeStaff([1] as Staff['availableDays']); // 月曜のみ
            expect(isStaffFixedHoliday(staff, SAT)).toBe(true);
        });
    });
});

describe('isStaffAvailableReason', () => {
    const noPrefs: ShiftPreference[] = [];

    it('希望休も固定休もなければ available', () => {
        const staff = makeStaff([{ day: 1 }]);
        expect(isStaffAvailableReason(staff, MON_W1, '2025-06-02', noPrefs)).toBe('available');
    });

    it('固定休の曜日は fixed', () => {
        const staff = makeStaff([{ day: 1 }]); // 月曜のみ
        expect(isStaffAvailableReason(staff, SAT, '2025-06-07', noPrefs)).toBe('fixed');
    });

    it('希望休（終日）は preference', () => {
        const staff = makeStaff([{ day: 1 }]);
        const prefs: ShiftPreference[] = [{
            id: 'p1',
            staffId: 'staff-1',
            yearMonth: '2025-06',
            submitted: false,
            details: [{ id: 'd1', staffId: 'staff-1', yearMonth: '2025-06', date: '2025-06-02', startTime: null, endTime: null }],
        }];
        expect(isStaffAvailableReason(staff, MON_W1, '2025-06-02', prefs)).toBe('preference');
    });

    it('希望休が時間指定（終日でない）の場合は fixed/available 判定を通す', () => {
        const staff = makeStaff([{ day: 1 }]);
        const prefs: ShiftPreference[] = [{
            id: 'p1',
            staffId: 'staff-1',
            yearMonth: '2025-06',
            submitted: false,
            details: [{ id: 'd1', staffId: 'staff-1', yearMonth: '2025-06', date: '2025-06-02', startTime: '09:00', endTime: '12:00' }],
        }];
        // 終日でないので preference には該当せず、固定休でもないため available
        expect(isStaffAvailableReason(staff, MON_W1, '2025-06-02', prefs)).toBe('available');
    });
});

describe('isStaffAvailable', () => {
    const noPrefs: ShiftPreference[] = [];

    it('出勤可能なら true', () => {
        const staff = makeStaff([{ day: 1 }]);
        expect(isStaffAvailable(staff, MON_W1, '2025-06-02', noPrefs)).toBe(true);
    });

    it('固定休なら false', () => {
        const staff = makeStaff([{ day: 1 }]);
        expect(isStaffAvailable(staff, SAT, '2025-06-07', noPrefs)).toBe(false);
    });

    it('祝日休館日なら false', () => {
        const staff = makeStaff([{ day: 1 }]);
        expect(isStaffAvailable(staff, MON_W1, '2025-06-02', noPrefs, [7], true)).toBe(false);
    });
});
