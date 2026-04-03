import type { Holiday } from '../types';

/**
 * 指定された年月の祝日マップを作成する
 * Key: YYYY-MM-DD, Value: Holiday
 */
export const createHolidayMap = (holidays: Holiday[]): Map<string, Holiday> => {
    const map = new Map<string, Holiday>();
    holidays.forEach(holiday => {
        map.set(holiday.date, holiday);
    });
    return map;
};

/**
 * 指定された日付が祝日かどうかを判定
 */
export const isHoliday = (dateStr: string, holidayMap: Map<string, Holiday>): boolean => {
    const holiday = holidayMap.get(dateStr);
    return holiday !== undefined && !holiday.isWorkday;
};

/**
 * 指定された日付の祝日情報を取得
 */
export const getHolidayInfo = (dateStr: string, holidayMap: Map<string, Holiday>): Holiday | undefined => {
    return holidayMap.get(dateStr);
};

/**
 * 日本の曜日を取得（0:日, 1:月, ..., 6:土）
 */
export const getDayOfWeek = (dateStr: string): number => {
    return new Date(dateStr).getDay();
};

/**
 * 土日祝判定
 * dayOfWeek: 0=日, 6=土
 */
export const isWeekendOrHoliday = (dateStr: string, holidayMap: Map<string, Holiday>): boolean => {
    const dayOfWeek = getDayOfWeek(dateStr);
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    return isHoliday(dateStr, holidayMap);
};

/**
 * 祝日名を取得（祝日でない場合は空文字）
 */
export const getHolidayName = (dateStr: string, holidayMap: Map<string, Holiday>): string => {
    const holiday = holidayMap.get(dateStr);
    return holiday?.name || '';
};

/**
 * 固定休日かどうかを判定
 * 祝日（非稼働日）かつ閉店日設定に含まれる場合、または勤務可能曜日に含まれない場合に true
 */
export const isFixedHoliday = (
    date: Date,
    holidays: Holiday[],
    closedDays: number[],
    closedDayHoliday: number,
    availableDays: any[]
): boolean => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday && !holiday.isWorkday && closedDays.includes(closedDayHoliday)) return true;

    if (!availableDays || availableDays.length === 0) return false;
    const dow = date.getDay();
    const nthWeek = Math.ceil(date.getDate() / 7);
    const config = availableDays.find((d: any) => (typeof d === 'number' ? d : d.day) === dow);
    if (!config) return true;
    if (typeof config === 'object' && config.weeks && !config.weeks.includes(nthWeek)) return true;
    return false;
};
