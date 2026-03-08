import { describe, it, expect } from 'vitest';
import {
    createHolidayMap,
    isHoliday,
    getHolidayInfo,
    getDayOfWeek,
    isWeekendOrHoliday,
    getHolidayName
} from '../holidayUtils';
import type { Holiday } from '../../types';

describe('holidayUtils', () => {
    const mockHolidays: Holiday[] = [
        { id: '1', date: '2025-01-01', name: '元日', type: 'national', isWorkday: false },
        { id: '2', date: '2025-02-11', name: '建国記念の日', type: 'national', isWorkday: false },
        { id: '3', date: '2025-05-03', name: '憲法記念日', type: 'national', isWorkday: false },
        { id: '4', date: '2025-05-05', name: 'こどもの日', type: 'national', isWorkday: false },
        { id: '5', date: '2025-11-03', name: '文化の日', type: 'national', isWorkday: false },
        { id: '6', date: '2025-11-23', name: '勤労感謝の日', type: 'national', isWorkday: false },
        { id: '7', date: '2025-02-23', name: '天皇誕生日', type: 'national', isWorkday: false },
        { id: '8', date: '2025-01-02', name: '平日扱い', type: 'company', isWorkday: true },
    ];

    const holidayMap = createHolidayMap(mockHolidays);

    describe('getHolidayName', () => {
        it('祝日の名前を正しく取得できる', () => {
            expect(getHolidayName('2025-01-01', holidayMap)).toBe('元日');
            expect(getHolidayName('2025-02-11', holidayMap)).toBe('建国記念の日');
        });

        it('祝日でない場合は空文字を返す', () => {
            expect(getHolidayName('2025-01-02', holidayMap)).toBe('平日扱い'); // 名前は入っている
            expect(getHolidayName('2025-01-03', holidayMap)).toBe('');
        });
    });

    describe('isHoliday', () => {
        it('祝日を正しく判定する', () => {
            expect(isHoliday('2025-01-01', holidayMap)).toBe(true);
        });

        it('isWorkdayがtrueの場合は祝日と判定しない', () => {
            expect(isHoliday('2025-01-02', holidayMap)).toBe(false);
        });

        it('マップにない日付はfalseを返す', () => {
            expect(isHoliday('2025-01-03', holidayMap)).toBe(false);
        });
    });

    describe('getHolidayInfo', () => {
        it('祝日情報を取得できる', () => {
            const info = getHolidayInfo('2025-01-01', holidayMap);
            expect(info).toBeDefined();
            expect(info?.name).toBe('元日');
        });

        it('祝日でない場合はundefinedを返す', () => {
            expect(getHolidayInfo('2025-01-03', holidayMap)).toBeUndefined();
        });
    });

    describe('getDayOfWeek', () => {
        it('曜日を数値で取得できる（0:日, 1:月, ...）', () => {
            expect(getDayOfWeek('2025-01-05')).toBe(0); // 日
            expect(getDayOfWeek('2025-01-06')).toBe(1); // 月
            expect(getDayOfWeek('2025-01-11')).toBe(6); // 土
        });
    });

    describe('isWeekendOrHoliday', () => {
        it('週末を判定できる', () => {
            expect(isWeekendOrHoliday('2025-01-04', holidayMap)).toBe(true); // 土
            expect(isWeekendOrHoliday('2025-01-05', holidayMap)).toBe(true); // 日
        });

        it('祝日を判定できる', () => {
            expect(isWeekendOrHoliday('2025-01-01', holidayMap)).toBe(true); // 元日（水）
        });

        it('平日はfalseを返す', () => {
            expect(isWeekendOrHoliday('2025-01-06', holidayMap)).toBe(false); // 月
        });
    });
});
