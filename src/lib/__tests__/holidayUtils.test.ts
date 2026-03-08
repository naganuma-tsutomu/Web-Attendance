import { describe, it, expect } from 'vitest';
import {
    getHolidayName,
    isSunday,
    isSaturday,
    isWeekday,
    isHoliday,
    isWorkingDay,
    getEquinoxDay,
    getHolidaysInRange,
    getNthWeekdayOfMonth,
    FIXED_HOLIDAYS
} from '../holidayUtils';

describe('holidayUtils', () => {
    describe('getHolidayName', () => {
        it('元日を正しく判定する', () => {
            const newYear = new Date(2025, 0, 1); // 2025年1月1日
            expect(getHolidayName(newYear)).toBe('元日');
        });

        it('固定祝日の建国記念の日を正しく判定する', () => {
            const nationalFoundation = new Date(2025, 1, 11); // 2025年2月11日
            expect(getHolidayName(nationalFoundation)).toBe('建国記念の日');
        });

        it('憲法記念日を正しく判定する', () => {
            const constitution = new Date(2025, 4, 3); // 2025年5月3日
            expect(getHolidayName(constitution)).toBe('憲法記念日');
        });

        it('こどもの日を正しく判定する', () => {
            const children = new Date(2025, 4, 5); // 2025年5月5日
            expect(getHolidayName(children)).toBe('こどもの日');
        });

        it('文化の日を正しく判定する', () => {
            const culture = new Date(2025, 10, 3); // 2025年11月3日
            expect(getHolidayName(culture)).toBe('文化の日');
        });

        it('勤労感謝の日を正しく判定する', () => {
            const labor = new Date(2025, 10, 23); // 2025年11月23日
            expect(getHolidayName(labor)).toBe('勤労感謝の日');
        });

        it('非祝日の場合はnullを返す', () => {
            const normalDay = new Date(2025, 4, 6); // 2025年5月6日（平日）
            expect(getHolidayName(normalDay)).toBeNull();
        });

        it('天皇誕生日（現行）を正しく判定する', () => {
            // 2025年2月23日
            const emperorsBirthday = new Date(2025, 1, 23);
            expect(getHolidayName(emperorsBirthday)).toBe('天皇誕生日');
        });
    });

    describe('isSunday', () => {
        it('日曜日を正しく判定する', () => {
            const sunday = new Date(2025, 0, 5); // 2025年1月5日
            expect(isSunday(sunday)).toBe(true);
        });

        it('日曜日以外はfalseを返す', () => {
            const monday = new Date(2025, 0, 6); // 2025年1月6日
            expect(isSunday(monday)).toBe(false);
        });
    });

    describe('isSaturday', () => {
        it('土曜日を正しく判定する', () => {
            const saturday = new Date(2025, 0, 4); // 2025年1月4日
            expect(isSaturday(saturday)).toBe(true);
        });

        it('土曜日以外はfalseを返す', () => {
            const friday = new Date(2025, 0, 3); // 2025年1月3日
            expect(isSaturday(friday)).toBe(false);
        });
    });

    describe('isWeekday', () => {
        it('月曜日から金曜日を正しく判定する', () => {
            // 2025年1月6日（月）
            expect(isWeekday(new Date(2025, 0, 6))).toBe(true);
            // 2025年1月7日（火）
            expect(isWeekday(new Date(2025, 0, 7))).toBe(true);
            // 2025年1月8日（水）
            expect(isWeekday(new Date(2025, 0, 8))).toBe(true);
            // 2025年1月9日（木）
            expect(isWeekday(new Date(2025, 0, 9))).toBe(true);
            // 2025年1月10日（金）
            expect(isWeekday(new Date(2025, 0, 10))).toBe(true);
        });

        it('土曜日と日曜日はfalseを返す', () => {
            // 2025年1月4日（土）
            expect(isWeekday(new Date(2025, 0, 4))).toBe(false);
            // 2025年1月5日（日）
            expect(isWeekday(new Date(2025, 0, 5))).toBe(false);
        });
    });

    describe('isHoliday', () => {
        it('日曜日を祝祭日として判定する', () => {
            const sunday = new Date(2025, 0, 5);
            expect(isHoliday(sunday)).toBe(true);
        });

        it('土曜日を祝祭日として判定する', () => {
            const saturday = new Date(2025, 0, 4);
            expect(isHoliday(saturday)).toBe(true);
        });

        it('祝日は祝祭日として判定する', () => {
            const newYear = new Date(2025, 0, 1);
            expect(isHoliday(newYear)).toBe(true);
        });

        it('平日（非祝祭日）はfalseを返す', () => {
            const weekday = new Date(2025, 0, 6); // 月曜日だが平日
            expect(isHoliday(weekday)).toBe(false);
        });
    });

    describe('isWorkingDay', () => {
        it('平日の場合はtrueを返す', () => {
            const weekday = new Date(2025, 0, 6); // 月曜日
            expect(isWorkingDay(weekday)).toBe(true);
        });

        it('日曜日はfalseを返す', () => {
            const sunday = new Date(2025, 0, 5);
            expect(isWorkingDay(sunday)).toBe(false);
        });

        it('土曜日はfalseを返す', () => {
            const saturday = new Date(2025, 0, 4);
            expect(isWorkingDay(saturday)).toBe(false);
        });

        it('祝日はfalseを返す', () => {
            const newYear = new Date(2025, 0, 1);
            expect(isWorkingDay(newYear)).toBe(false);
        });
    });

    describe('getEquinoxDay', () => {
        it('春分の日を取得できる', () => {
            const spring = getEquinoxDay(2025, 'spring');
            expect(spring.getMonth()).toBe(2); // 3月
            expect(spring.getDate()).toBeGreaterThanOrEqual(20);
            expect(spring.getDate()).toBeLessThanOrEqual(21);
        });

        it('秋分の日を取得できる', () => {
            const autumn = getEquinoxDay(2025, 'autumn');
            expect(autumn.getMonth()).toBe(8); // 9月
            expect(autumn.getDate()).toBeGreaterThanOrEqual(22);
            expect(autumn.getDate()).toBeLessThanOrEqual(24);
        });
    });

    describe('getHolidaysInRange', () => {
        it('指定範囲内の祝祭日を取得できる', () => {
            // 2025年1月1日（元日）から2025年1月7日までの範囲
            const start = new Date(2025, 0, 1);
            const end = new Date(2025, 0, 7);
            const holidays = getHolidaysInRange(start, end);
            
            // 1月1日（元日）、1月5日（日）が含まれる
            expect(holidays.length).toBeGreaterThan(0);
        });

        it('祝祭日がない場合は空配列を返す', () => {
            // 2025年5月6日（火：平日）から2025年5月9日（金）までの範囲
            const start = new Date(2025, 4, 6);
            const end = new Date(2025, 4, 9);
            const holidays = getHolidaysInRange(start, end);
            
            // 祝祭日がない（5月6日〜9日は平日）
            expect(holidays.length).toBe(0);
        });
    });

    describe('getNthWeekdayOfMonth', () => {
        it('第2月曜日を取得できる（成人の日）', () => {
            // 2025年1月の第2月曜日
            const result = getNthWeekdayOfMonth(2025, 0, 1, 2);
            expect(result).not.toBeNull();
            expect(result?.getDate()).toBe(13);
        });

        it('第3月曜日を取得できる（敬老の日）', () => {
            // 2025年9月の第3月曜日
            const result = getNthWeekdayOfMonth(2025, 8, 1, 3);
            expect(result).not.toBeNull();
            expect(result?.getDate()).toBe(15);
        });

        it('第3月曜日を取得できる（海の日）', () => {
            // 2025年7月の第3月曜日
            const result = getNthWeekdayOfMonth(2025, 6, 1, 3);
            expect(result).not.toBeNull();
            expect(result?.getDate()).toBe(21);
        });

        it('存在しない回の場合はnullを返す', () => {
            // 2月は第5月曜日がないことが多い
            const result = getNthWeekdayOfMonth(2025, 1, 1, 5);
            expect(result).toBeNull();
        });

        it('最終月曜日を取得できる', () => {
            // 2025年1月の最終月曜日
            const result = getNthWeekdayOfMonth(2025, 0, 1, -1);
            expect(result).not.toBeNull();
            expect(result?.getDate()).toBe(27);
        });
    });

    describe('FIXED_HOLIDAYS', () => {
        it('固定祝日のリストが存在する', () => {
            expect(FIXED_HOLIDAYS.length).toBeGreaterThan(0);
        });

        it('主要な祝日は含まれている', () => {
            const holidayNames = FIXED_HOLIDAYS.map(h => h.name);
            expect(holidayNames).toContain('元日');
            expect(holidayNames).toContain('憲法記念日');
            expect(holidayNames).toContain('こどもの日');
            expect(holidayNames).toContain('文化の日');
            expect(holidayNames).toContain('勤労感謝の日');
        });
    });
});
