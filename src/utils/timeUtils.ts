import { UNASSIGNED_STAFF_ID } from '../constants';
import type { BreakSettings } from '../types';
export { timeRangesOverlap } from '../../shared/shiftIntegrity';

/**
 * デフォルトの休憩設定
 */
export const DEFAULT_BREAK_SETTINGS: BreakSettings = {
    exceptionEnabled: false,
    exceptionThresholdTime: '12:00',
    exceptionBreakMinutes: 30,
    displayActualHoursInModal: false,
    displayActualHoursInExcel: false,
};

/**
 * Convert a HH:MM string to total minutes.
 */
export const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Calculate duration in hours between two HH:MM strings.
 * Supports day-crossing (e.g., 22:00 to 02:00 = 4.0 hours).
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;

    const startMinutes = timeToMinutes(startTime);
    let endMinutes = timeToMinutes(endTime);

    // Handle overnight shifts
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
};

/**
 * 法定休憩時間を算出する（分単位）
 *
 * 労働基準法34条:
 * - 8時間を超える場合: 60分
 * - 6時間を超え8時間以下: 45分
 * - 6時間以下: 0分
 */
export const calculateLegalBreak = (workingMinutes: number): number => {
    if (workingMinutes > 8 * 60) return 60;
    if (workingMinutes > 6 * 60) return 45;
    return 0;
};

/**
 * 例外休憩を算出する（分単位）
 *
 * 出勤時刻が閾値以前（<=）の場合に例外休憩を適用する。
 * 例外が無効な場合は0を返す。
 */
export const calculateExceptionBreak = (
    startTime: string,
    settings: BreakSettings
): number => {
    if (!settings.exceptionEnabled) return 0;

    const startMins = timeToMinutes(startTime);
    const thresholdMins = timeToMinutes(settings.exceptionThresholdTime);

    return startMins <= thresholdMins ? settings.exceptionBreakMinutes : 0;
};

/**
 * 最終的な休憩時間を算出する（分単位）
 *
 * 法定休憩と例外休憩の大きい方を採用する。
 * 法定休憩が適用される場合（>0）は、例外は含まれない（法定が優先）。
 */
export const calculateBreakMinutes = (
    startTime: string,
    endTime: string,
    settings?: BreakSettings
): number => {
    if (!startTime || !endTime) return 0;

    const durationMins = calculateDuration(startTime, endTime) * 60;
    const legalBreak = calculateLegalBreak(durationMins);
    const exceptionBreak = settings
        ? calculateExceptionBreak(startTime, settings)
        : 0;

    return Math.max(legalBreak, exceptionBreak);
};

/**
 * 実労働時間を算出する（時間単位）
 *
 * シフト時間 - 休憩時間 = 実労働時間
 */
export const calculateActualWorkingHours = (
    startTime: string,
    endTime: string,
    settings?: BreakSettings
): number => {
    if (!startTime || !endTime) return 0;

    const totalHours = calculateDuration(startTime, endTime);
    const breakMins = calculateBreakMinutes(startTime, endTime, settings);

    return Math.max(0, totalHours - breakMins / 60);
};

/**
 * Calculate total hours for each staff member from a list of shifts.
 * breakSettings が渡された場合は実労働時間（休憩差引後）で集計する。
 */
export const calculateTotalHours = (
    shifts: { staffId: string, startTime: string, endTime: string, isError?: boolean }[],
    breakSettings?: BreakSettings
): Record<string, number> => {
    const totals: Record<string, number> = {};

    shifts.forEach(shift => {
        if (!shift.staffId || shift.staffId === UNASSIGNED_STAFF_ID || shift.isError) return;

        const duration = breakSettings
            ? calculateActualWorkingHours(shift.startTime, shift.endTime, breakSettings)
            : calculateDuration(shift.startTime, shift.endTime);
        totals[shift.staffId] = (totals[shift.staffId] || 0) + duration;
    });

    return totals;
};
/**
 * Formats hours to 0.25 increments (e.g., 20.25, 20.5, 20.75, 21.0).
 * Rounds to the nearest 0.25.
 */
export const formatHours = (hours: number): string => {
    const rounded = Math.round(hours * 4) / 4;
    if (rounded % 1 === 0) return rounded.toFixed(1); // "20.0"
    if (rounded % 0.5 === 0) return rounded.toFixed(1); // "20.5"
    return rounded.toFixed(2); // "20.25", "20.75"
};
