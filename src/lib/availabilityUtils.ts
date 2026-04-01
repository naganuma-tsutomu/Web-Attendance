import { getDay } from 'date-fns';
import type { Staff, ShiftPreference } from '../types';

/**
 * スタッフの固定休（利用可能日設定による休日）を判定する
 */
export const isStaffFixedHoliday = (
    staff: Staff,
    date: Date,
    closedDays: number[] = [],
    isNationalHoliday: boolean = false
): boolean => {
    const dayOfWeek = getDay(date);

    // 祝日が休館日の場合
    if (isNationalHoliday && closedDays.includes(7)) {
        return true;
    }

    if (!staff.availableDays || staff.availableDays.length === 0) {
        return false;
    }

    const nthWeek = Math.ceil(date.getDate() / 7);
    const config = staff.availableDays.find(d => (typeof d === 'number' ? d : d.day) === dayOfWeek);

    // 設定が見つからない場合、日曜日（0）以外は毎週休みと判定する
    if (!config) {
        if (dayOfWeek !== 0) return true;
    } else if (typeof config === 'object' && config.weeks && !config.weeks.includes(nthWeek)) {
        return true;
    }

    return false;
};

/**
 * Get the reason why a staff member is unavailable for a specific date
 */
export const isStaffAvailableReason = (
    staff: Staff,
    date: Date,
    dateStr: string,
    preferences: ShiftPreference[],
    closedDays: number[] = [],
    isNationalHoliday: boolean = false
): 'available' | 'preference' | 'fixed' => {
    // 1. Check Shift Preference (休日管理) - 終日不可のみチェック
    const pref = preferences.find(p => p.staffId === staff.id);
    if (pref) {
        if (pref.details && pref.details.length > 0) {
            const fullDayEntry = pref.details.find(d => d.date === dateStr && !d.startTime && !d.endTime);
            if (fullDayEntry) return 'preference';
        }
    }

    // 2. Check Staff Base Availability (固定休)
    if (isStaffFixedHoliday(staff, date, closedDays, isNationalHoliday)) {
        return 'fixed';
    }

    return 'available';
};

/**
 * Check if a staff member is available for a specific date
 */
export const isStaffAvailable = (
    staff: Staff,
    date: Date,
    dateStr: string,
    preferences: ShiftPreference[],
    closedDays: number[] = [],
    isNationalHoliday: boolean = false
): boolean => {
    return isStaffAvailableReason(staff, date, dateStr, preferences, closedDays, isNationalHoliday) === 'available';
};
