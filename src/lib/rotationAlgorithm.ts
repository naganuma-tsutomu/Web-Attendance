import { format, getDay, startOfISOWeek } from 'date-fns';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftTimePattern, RotationSettings, BreakSettings } from '../types';
import { isStaffAvailable, isStaffAvailableDuringTime } from './availabilityUtils';
import { calcDuration } from './algorithm';
import { timeToMinutes } from '../utils/timeUtils';

/**
 * Pick a class for a rotation shift.
 * Uses only the classes the staff is assigned to (classIds).
 * Uses all auto-allocatable classes only if the staff has no class assignment.
 * Among eligible classes, picks the one with the fewest rotation shifts today.
 */
const pickClassForRotation = (
    staff: Staff,
    classes: ShiftClass[],
    generatedShifts: Shift[],
    dateStr: string
): string | null => {
    const autoAllocatableClasses = classes.filter(c => c.auto_allocate !== 0);
    if (autoAllocatableClasses.length === 0) return null;

    const eligibleClasses = staff.classIds && staff.classIds.length > 0
        ? autoAllocatableClasses.filter(c => staff.classIds!.includes(c.id))
        : autoAllocatableClasses;

    if (eligibleClasses.length === 0) return null;
    if (eligibleClasses.length === 1) return eligibleClasses[0].id;

    // Among eligible classes, pick the one with the fewest shifts today
    const counts = eligibleClasses.map(c => ({
        id: c.id,
        count: generatedShifts.filter(s => s.date === dateStr && s.classType === c.id).length
    }));
    counts.sort((a, b) => a.count - b.count);
    return counts[0].id;
};

const shiftsOverlap = (
    firstStart: string,
    firstEnd: string,
    secondStart: string,
    secondEnd: string
): boolean => {
    const firstStartMinutes = timeToMinutes(firstStart);
    const firstEndMinutes = timeToMinutes(firstEnd);
    const secondStartMinutes = timeToMinutes(secondStart);
    const secondEndMinutes = timeToMinutes(secondEnd);
    return firstStartMinutes < secondEndMinutes && firstEndMinutes > secondStartMinutes;
};

/**
 * Add a rotation shift and update hour tracking
 */
const addRotationShift = (
    generatedShifts: Shift[],
    dateStr: string,
    date: Date,
    staff: Staff,
    pattern: ShiftTimePattern,
    classes: ShiftClass[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    shiftType: 'early' | 'late',
    breakSettings?: BreakSettings,
    preferences: ShiftPreference[] = [],
    existingShifts: Shift[] = []
): boolean => {
    const classId = pickClassForRotation(staff, classes, generatedShifts, dateStr);
    if (!classId) return false;

    if (!isStaffAvailableDuringTime(
        staff, date, dateStr, pattern.startTime, pattern.endTime, preferences
    )) return false;

    const hasOverlap = [...existingShifts, ...generatedShifts].some(shift =>
        shift.staffId === staff.id &&
        shift.date === dateStr &&
        !shift.isError &&
        shiftsOverlap(pattern.startTime, pattern.endTime, shift.startTime, shift.endTime)
    );
    if (hasOverlap) return false;

    const duration = calcDuration(pattern.startTime, pattern.endTime, breakSettings);
    const staffCurrentHours = currentHours[staff.id] ?? 0;
    if (staff.hoursTarget != null && staffCurrentHours + duration > staff.hoursTarget) {
        return false;
    }

    const weekKey = `w-${format(startOfISOWeek(date), 'yyyy-MM-dd')}`;
    const currentWeekHours = currentWeeklyHours[staff.id]?.[weekKey] ?? 0;
    if (staff.weeklyHoursTarget != null && currentWeekHours + duration > staff.weeklyHoursTarget) {
        return false;
    }

    generatedShifts.push({
        id: `rot_${dateStr}_${shiftType}_${staff.id}`,
        date: dateStr,
        staffId: staff.id,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        classType: classId
    });

    currentHours[staff.id] = staffCurrentHours + duration;
    if (!currentWeeklyHours[staff.id]) currentWeeklyHours[staff.id] = {};
    currentWeeklyHours[staff.id][weekKey] = (currentWeeklyHours[staff.id][weekKey] || 0) + duration;
    return true;
};

// ==========================================
// ローテーション用 内部状態型
// ==========================================

export interface RotationState {
    previousDayEarly: string[];
    previousDayLate: string[];
    lastEarlyShift: Record<string, string>;
    lastLateShift: Record<string, string>;
    earlyShiftCount: Record<string, number>;
    lateShiftCount: Record<string, number>;
}

/**
 * 前月の最終稼働日のシフトからローテーション状態を復元する
 */
export const restorePreviousMonthState = (
    existingShifts: Shift[],
    firstDay: Date,
    rotationStaff: Staff[],
    earlyPattern: ShiftTimePattern,
    latePattern: ShiftTimePattern,
    state: RotationState
): void => {
    const prevMonthShifts = existingShifts.filter(s => s.date < format(firstDay, 'yyyy-MM-dd'));
    if (prevMonthShifts.length === 0) return;

    const sortedDates = [...new Set(prevMonthShifts.map(s => s.date))].sort();
    const lastWorkingDay = sortedDates[sortedDates.length - 1];

    for (const shift of prevMonthShifts) {
        if (!rotationStaff.some(rs => rs.id === shift.staffId)) continue;

        if (shift.startTime === earlyPattern.startTime && shift.endTime === earlyPattern.endTime) {
            if (!state.lastEarlyShift[shift.staffId] || shift.date > state.lastEarlyShift[shift.staffId]) {
                state.lastEarlyShift[shift.staffId] = shift.date;
            }
            if (shift.date === lastWorkingDay) {
                state.previousDayEarly.push(shift.staffId);
            }
        } else if (shift.startTime === latePattern.startTime && shift.endTime === latePattern.endTime) {
            if (!state.lastLateShift[shift.staffId] || shift.date > state.lastLateShift[shift.staffId]) {
                state.lastLateShift[shift.staffId] = shift.date;
            }
            if (shift.date === lastWorkingDay) {
                state.previousDayLate.push(shift.staffId);
            }
        }
    }
};

/**
 * 土曜日のローテーションシフトを割り当てる
 */
export const assignSaturdayShifts = (
    date: Date,
    dateStr: string,
    available: Staff[],
    settings: RotationSettings,
    latePattern: ShiftTimePattern,
    classes: ShiftClass[],
    generatedShifts: Shift[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    state: RotationState,
    breakSettings: BreakSettings | undefined,
    sortByLatePriority: (a: Staff, b: Staff) => number,
    preferences: ShiftPreference[] = [],
    existingShifts: Shift[] = []
): void => {
    if (!settings.saturdayEnabled) return;

    let candidates: Staff[];
    if (settings.saturdayPreferFridayLate && state.previousDayLate.length > 0) {
        const fridayLate = available.filter(s => state.previousDayLate.includes(s.id)).sort(sortByLatePriority);
        const others = available.filter(s => !state.previousDayLate.includes(s.id)).sort(sortByLatePriority);
        candidates = [...fridayLate, ...others];
    } else {
        candidates = [...available].sort(sortByLatePriority);
    }

    const saturdayAssigned: string[] = [];
    for (const candidate of candidates) {
        if (saturdayAssigned.length >= settings.saturdayCount) break;
        const assigned = addRotationShift(
            generatedShifts, dateStr, date, candidate, latePattern, classes,
            currentHours, currentWeeklyHours, 'late', breakSettings, preferences, existingShifts
        );
        if (!assigned) continue;

        saturdayAssigned.push(candidate.id);
        state.lastLateShift[candidate.id] = dateStr;
        state.lateShiftCount[candidate.id] = (state.lateShiftCount[candidate.id] || 0) + 1;
    }
    state.previousDayLate = Array.from(new Set([...state.previousDayLate, ...saturdayAssigned]));
};

/**
 * 平日（月〜金）のローテーションシフト（早番・遅番）を割り当てる
 */
export const assignWeekdayShifts = (
    date: Date,
    dateStr: string,
    available: Staff[],
    settings: RotationSettings,
    earlyPattern: ShiftTimePattern,
    latePattern: ShiftTimePattern,
    classes: ShiftClass[],
    generatedShifts: Shift[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    state: RotationState,
    breakSettings: BreakSettings | undefined,
    sortByEarlyPriority: (a: Staff, b: Staff) => number,
    sortByLatePriority: (a: Staff, b: Staff) => number,
    preferences: ShiftPreference[] = [],
    existingShifts: Shift[] = []
): void => {
    const earlyAssigned: string[] = [];
    const lateAssigned: string[] = [];

    const normalForEarly = available.filter(s => !state.previousDayEarly.includes(s.id)).sort(sortByEarlyPriority);
    const prevEarlyForEarly = available.filter(s => state.previousDayEarly.includes(s.id)).sort(sortByEarlyPriority);
    const earlyCandidates = [...normalForEarly, ...prevEarlyForEarly];

    for (const candidate of earlyCandidates) {
        if (earlyAssigned.length >= settings.weekdayEarlyCount) break;
        const assigned = addRotationShift(
            generatedShifts, dateStr, date, candidate, earlyPattern, classes,
            currentHours, currentWeeklyHours, 'early', breakSettings, preferences, existingShifts
        );
        if (!assigned) continue;

        earlyAssigned.push(candidate.id);
        state.lastEarlyShift[candidate.id] = dateStr;
        state.earlyShiftCount[candidate.id] = (state.earlyShiftCount[candidate.id] || 0) + 1;
    }

    const normalForLate = available.filter(s => !state.previousDayLate.includes(s.id) && !earlyAssigned.includes(s.id)).sort(sortByLatePriority);
    const prevLateForLate = available.filter(s => state.previousDayLate.includes(s.id) && !earlyAssigned.includes(s.id)).sort(sortByLatePriority);
    const lateCandidates = [...normalForLate, ...prevLateForLate];

    for (const candidate of lateCandidates) {
        if (lateAssigned.length >= settings.weekdayLateCount) break;
        const assigned = addRotationShift(
            generatedShifts, dateStr, date, candidate, latePattern, classes,
            currentHours, currentWeeklyHours, 'late', breakSettings, preferences, existingShifts
        );
        if (!assigned) continue;

        lateAssigned.push(candidate.id);
        state.lastLateShift[candidate.id] = dateStr;
        state.lateShiftCount[candidate.id] = (state.lateShiftCount[candidate.id] || 0) + 1;
    }

    state.previousDayEarly = earlyAssigned;
    state.previousDayLate = lateAssigned;
};

/**
 * Apply rotation logic for full-time staff (正社員ローテーション)
 */
export const applyRotation = (
    days: Date[],
    settings: RotationSettings,
    staffList: Staff[],
    preferences: ShiftPreference[],
    generatedShifts: Shift[],
    currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>,
    closedDays: number[],
    holidays: string[],
    fixedDates: string[],
    existingShifts: Shift[],
    allPatterns: ShiftTimePattern[],
    classes: ShiftClass[],
    roles: DynamicRole[],
    breakSettings?: BreakSettings
): void => {
    const selectedRole = roles.find(r => r.id === settings.roleId);
    const rotationStaff = selectedRole
        ? staffList.filter(s => s.role === selectedRole.name)
        : [];
    if (rotationStaff.length === 0) return;

    const earlyPattern = allPatterns.find(p => p.id === settings.earlyPatternId);
    const latePattern = allPatterns.find(p => p.id === settings.latePatternId);
    if (!earlyPattern || !latePattern) return;

    const state: RotationState = {
        previousDayEarly: [],
        previousDayLate: [],
        lastEarlyShift: {},
        lastLateShift: {},
        earlyShiftCount: Object.fromEntries(rotationStaff.map(s => [s.id, 0])),
        lateShiftCount: Object.fromEntries(rotationStaff.map(s => [s.id, 0])),
    };

    restorePreviousMonthState(existingShifts, days[0], rotationStaff, earlyPattern, latePattern, state);

    const sortByEarlyPriority = (a: Staff, b: Staff) => {
        const countA = state.earlyShiftCount[a.id] || 0;
        const countB = state.earlyShiftCount[b.id] || 0;
        if (countA !== countB) return countA - countB;

        const dateA = state.lastEarlyShift[a.id] || '2000-01-01';
        const dateB = state.lastEarlyShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        return currentHours[a.id] - currentHours[b.id];
    };

    const sortByLatePriority = (a: Staff, b: Staff) => {
        const countA = state.lateShiftCount[a.id] || 0;
        const countB = state.lateShiftCount[b.id] || 0;
        if (countA !== countB) return countA - countB;

        const dateA = state.lastLateShift[a.id] || '2000-01-01';
        const dateB = state.lastLateShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        return currentHours[a.id] - currentHours[b.id];
    };

    for (const date of days) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);

        if (closedDays.includes(dayOfWeek) || holidays.includes(dateStr) || fixedDates.includes(dateStr)) {
            continue;
        }

        const available = rotationStaff.filter(s => isStaffAvailable(s, date, dateStr, preferences, closedDays, holidays.includes(dateStr)));
        if (available.length === 0) continue;

        if (dayOfWeek === 6) {
            const saturdayPattern = settings.saturdayPatternId
                ? allPatterns.find(p => p.id === settings.saturdayPatternId) ?? latePattern
                : latePattern;
            assignSaturdayShifts(
                date, dateStr, available, settings, saturdayPattern, classes,
                generatedShifts, currentHours, currentWeeklyHours, state,
                breakSettings, sortByLatePriority, preferences, existingShifts
            );
            continue;
        }

        if (dayOfWeek < 1 || dayOfWeek > 5) continue;

        assignWeekdayShifts(
            date, dateStr, available, settings, earlyPattern, latePattern, classes,
            generatedShifts, currentHours, currentWeeklyHours, state,
            breakSettings, sortByEarlyPriority, sortByLatePriority,
            preferences, existingShifts
        );
    }
};
