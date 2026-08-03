import { format, getDay, startOfISOWeek } from 'date-fns';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftTimePattern, RotationSettings, BreakSettings, BusinessDayOverride } from '../types';
import { isStaffAvailable, isStaffAvailableDuringTime } from './availabilityUtils';
import { calcDuration } from './algorithm';
import { timeRangesOverlap } from '../utils/timeUtils';

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
    dateStr: string,
    state: RotationState
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
        displayOrder: c.display_order,
        dailyCount: generatedShifts.filter(s => s.date === dateStr && s.classType === c.id).length,
        monthlyCount: state.classAssignmentCount[c.id] || 0,
        staffCount: state.staffClassAssignmentCount[staff.id]?.[c.id] || 0,
        lastDate: state.lastClassAssignmentDate[c.id] || '2000-01-01',
    }));
    counts.sort((a, b) =>
        a.dailyCount - b.dailyCount ||
        a.monthlyCount - b.monthlyCount ||
        a.staffCount - b.staffCount ||
        a.lastDate.localeCompare(b.lastDate) ||
        a.displayOrder - b.displayOrder ||
        a.id.localeCompare(b.id)
    );
    return counts[0].id;
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
    state: RotationState,
    breakSettings?: BreakSettings,
    preferences: ShiftPreference[] = [],
    existingShifts: Shift[] = []
): boolean => {
    const classId = pickClassForRotation(staff, classes, generatedShifts, dateStr, state);
    if (!classId) return false;

    if (!isStaffAvailableDuringTime(
        staff, date, dateStr, pattern.startTime, pattern.endTime, preferences
    )) return false;

    const hasOverlap = [...existingShifts, ...generatedShifts].some(shift =>
        shift.staffId === staff.id &&
        shift.date === dateStr &&
        !shift.isError &&
        timeRangesOverlap(pattern.startTime, pattern.endTime, shift.startTime, shift.endTime)
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
    state.classAssignmentCount[classId] = (state.classAssignmentCount[classId] || 0) + 1;
    state.lastClassAssignmentDate[classId] = dateStr;
    if (!state.staffClassAssignmentCount[staff.id]) state.staffClassAssignmentCount[staff.id] = {};
    state.staffClassAssignmentCount[staff.id][classId] =
        (state.staffClassAssignmentCount[staff.id][classId] || 0) + 1;
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
    saturdayShiftCount: Record<string, number>;
    lastSaturdayShift: Record<string, string>;
    classAssignmentCount: Record<string, number>;
    lastClassAssignmentDate: Record<string, string>;
    staffClassAssignmentCount: Record<string, Record<string, number>>;
}

const matchesPattern = (shift: Shift, pattern: ShiftTimePattern): boolean =>
    shift.startTime === pattern.startTime && shift.endTime === pattern.endTime;

const recordClassAssignment = (
    state: RotationState,
    staffId: string,
    classId: string,
    dateStr: string
): void => {
    state.classAssignmentCount[classId] = (state.classAssignmentCount[classId] || 0) + 1;
    state.lastClassAssignmentDate[classId] = dateStr;
    if (!state.staffClassAssignmentCount[staffId]) state.staffClassAssignmentCount[staffId] = {};
    state.staffClassAssignmentCount[staffId][classId] =
        (state.staffClassAssignmentCount[staffId][classId] || 0) + 1;
};

export const applyExistingDayToRotationState = (
    dateStr: string,
    existingShifts: Shift[],
    rotationStaff: Staff[],
    earlyPattern: ShiftTimePattern | null,
    latePattern: ShiftTimePattern | null,
    state: RotationState,
    isSaturday = false
): void => {
    const rotationStaffIds = new Set(rotationStaff.map(staff => staff.id));
    const earlyAssigned = new Set<string>();
    const lateAssigned = new Set<string>();

    for (const shift of existingShifts) {
        if (
            shift.date !== dateStr ||
            shift.isError ||
            !rotationStaffIds.has(shift.staffId)
        ) continue;

        if (earlyPattern && matchesPattern(shift, earlyPattern)) {
            earlyAssigned.add(shift.staffId);
            state.lastEarlyShift[shift.staffId] = dateStr;
            state.earlyShiftCount[shift.staffId] = (state.earlyShiftCount[shift.staffId] || 0) + 1;
            recordClassAssignment(state, shift.staffId, shift.classType, dateStr);
        } else if (latePattern && matchesPattern(shift, latePattern)) {
            lateAssigned.add(shift.staffId);
            state.lastLateShift[shift.staffId] = dateStr;
            state.lateShiftCount[shift.staffId] = (state.lateShiftCount[shift.staffId] || 0) + 1;
            if (isSaturday) {
                state.lastSaturdayShift[shift.staffId] = dateStr;
                state.saturdayShiftCount[shift.staffId] =
                    (state.saturdayShiftCount[shift.staffId] || 0) + 1;
            }
            recordClassAssignment(state, shift.staffId, shift.classType, dateStr);
        }
    }

    state.previousDayEarly = [...earlyAssigned];
    state.previousDayLate = [...lateAssigned];
};

/**
 * 前月の最終稼働日のシフトからローテーション状態を復元する
 */
export const restorePreviousMonthState = (
    existingShifts: Shift[],
    firstDay: Date,
    rotationStaff: Staff[],
    earlyPattern: ShiftTimePattern,
    latePattern: ShiftTimePattern,
    state: RotationState,
    saturdayPattern?: ShiftTimePattern
): void => {
    const rotationStaffIds = new Set(rotationStaff.map(staff => staff.id));
    const firstDateStr = format(firstDay, 'yyyy-MM-dd');
    const prevMonthShifts = existingShifts.filter(shift =>
        shift.date < firstDateStr &&
        !shift.isError &&
        rotationStaffIds.has(shift.staffId) &&
        (
            matchesPattern(shift, earlyPattern) ||
            matchesPattern(shift, latePattern) ||
            Boolean(saturdayPattern && matchesPattern(shift, saturdayPattern))
        )
    );
    if (prevMonthShifts.length === 0) return;

    const sortedDates = [...new Set(prevMonthShifts.map(s => s.date))].sort();
    const lastWorkingDay = sortedDates[sortedDates.length - 1];

    for (const shift of prevMonthShifts) {
        if (matchesPattern(shift, earlyPattern)) {
            if (!state.lastEarlyShift[shift.staffId] || shift.date > state.lastEarlyShift[shift.staffId]) {
                state.lastEarlyShift[shift.staffId] = shift.date;
            }
            if (shift.date === lastWorkingDay) {
                state.previousDayEarly.push(shift.staffId);
            }
        } else if (
            matchesPattern(shift, latePattern) ||
            Boolean(saturdayPattern && matchesPattern(shift, saturdayPattern))
        ) {
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
    sortBySaturdayPriority: (a: Staff, b: Staff) => number,
    preferences: ShiftPreference[] = [],
    existingShifts: Shift[] = []
): void => {
    if (!settings.saturdayEnabled) return;

    let candidates: Staff[];
    if (settings.saturdayPreferFridayLate && state.previousDayLate.length > 0) {
        const fridayLate = available.filter(s => state.previousDayLate.includes(s.id)).sort(sortBySaturdayPriority);
        const others = available.filter(s => !state.previousDayLate.includes(s.id)).sort(sortBySaturdayPriority);
        candidates = [...fridayLate, ...others];
    } else {
        candidates = [...available].sort(sortBySaturdayPriority);
    }

    const saturdayAssigned: string[] = [];
    for (const candidate of candidates) {
        if (saturdayAssigned.length >= settings.saturdayCount) break;
        const assigned = addRotationShift(
            generatedShifts, dateStr, date, candidate, latePattern, classes,
            currentHours, currentWeeklyHours, 'late', state, breakSettings, preferences, existingShifts
        );
        if (!assigned) continue;

        saturdayAssigned.push(candidate.id);
        state.lastLateShift[candidate.id] = dateStr;
        state.lateShiftCount[candidate.id] = (state.lateShiftCount[candidate.id] || 0) + 1;
        state.lastSaturdayShift[candidate.id] = dateStr;
        state.saturdayShiftCount[candidate.id] = (state.saturdayShiftCount[candidate.id] || 0) + 1;
    }
    state.previousDayEarly = [];
    state.previousDayLate = saturdayAssigned;
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
            currentHours, currentWeeklyHours, 'early', state, breakSettings, preferences, existingShifts
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
            currentHours, currentWeeklyHours, 'late', state, breakSettings, preferences, existingShifts
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
    breakSettings?: BreakSettings,
    businessDayOverrides: BusinessDayOverride[] = []
): void => {
    const selectedRole = roles.find(r => r.id === settings.roleId);
    const rotationStaff = selectedRole
        ? staffList.filter(s => s.role === selectedRole.name)
        : [];
    if (rotationStaff.length === 0) return;

    const earlyPattern = allPatterns.find(p => p.id === settings.earlyPatternId);
    const latePattern = allPatterns.find(p => p.id === settings.latePatternId);
    if (!earlyPattern || !latePattern) return;
    const businessDayOverrideMap = new Map(businessDayOverrides.map(item => [item.date, item]));
    const saturdayPattern = settings.saturdayPatternId
        ? allPatterns.find(p => p.id === settings.saturdayPatternId) ?? latePattern
        : latePattern;

    const state: RotationState = {
        previousDayEarly: [],
        previousDayLate: [],
        lastEarlyShift: {},
        lastLateShift: {},
        earlyShiftCount: Object.fromEntries(rotationStaff.map(s => [s.id, 0])),
        lateShiftCount: Object.fromEntries(rotationStaff.map(s => [s.id, 0])),
        saturdayShiftCount: Object.fromEntries(rotationStaff.map(s => [s.id, 0])),
        lastSaturdayShift: {},
        classAssignmentCount: Object.fromEntries(classes.map(c => [c.id, 0])),
        lastClassAssignmentDate: {},
        staffClassAssignmentCount: Object.fromEntries(rotationStaff.map(s => [s.id, {}])),
    };

    restorePreviousMonthState(
        existingShifts,
        days[0],
        rotationStaff,
        earlyPattern,
        latePattern,
        state,
        saturdayPattern
    );

    const sortByEarlyPriority = (a: Staff, b: Staff) => {
        const countA = state.earlyShiftCount[a.id] || 0;
        const countB = state.earlyShiftCount[b.id] || 0;
        if (countA !== countB) return countA - countB;

        const dateA = state.lastEarlyShift[a.id] || '2000-01-01';
        const dateB = state.lastEarlyShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const totalDiff =
            (state.earlyShiftCount[a.id] || 0) + (state.lateShiftCount[a.id] || 0) -
            (state.earlyShiftCount[b.id] || 0) - (state.lateShiftCount[b.id] || 0);
        if (totalDiff !== 0) return totalDiff;

        const hoursDiff = currentHours[a.id] - currentHours[b.id];
        if (hoursDiff !== 0) return hoursDiff;
        const displayOrderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        return displayOrderDiff || a.id.localeCompare(b.id);
    };

    const sortByLatePriority = (a: Staff, b: Staff) => {
        const countA = state.lateShiftCount[a.id] || 0;
        const countB = state.lateShiftCount[b.id] || 0;
        if (countA !== countB) return countA - countB;

        const dateA = state.lastLateShift[a.id] || '2000-01-01';
        const dateB = state.lastLateShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const totalDiff =
            (state.earlyShiftCount[a.id] || 0) + (state.lateShiftCount[a.id] || 0) -
            (state.earlyShiftCount[b.id] || 0) - (state.lateShiftCount[b.id] || 0);
        if (totalDiff !== 0) return totalDiff;

        const hoursDiff = currentHours[a.id] - currentHours[b.id];
        if (hoursDiff !== 0) return hoursDiff;
        const displayOrderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
        return displayOrderDiff || a.id.localeCompare(b.id);
    };

    const sortBySaturdayPriority = (a: Staff, b: Staff) => {
        const countDiff =
            (state.saturdayShiftCount[a.id] || 0) - (state.saturdayShiftCount[b.id] || 0);
        if (countDiff !== 0) return countDiff;
        const dateA = state.lastSaturdayShift[a.id] || '2000-01-01';
        const dateB = state.lastSaturdayShift[b.id] || '2000-01-01';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return sortByLatePriority(a, b);
    };

    for (const date of days) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);
        const businessDayOverride = businessDayOverrideMap.get(dateStr);
        const individuallyOpen = businessDayOverride?.status === 'open';

        if (businessDayOverride?.status === 'closed' || (!individuallyOpen && (closedDays.includes(dayOfWeek) || holidays.includes(dateStr)))) {
            continue;
        }

        if (fixedDates.includes(dateStr)) {
            if (dayOfWeek < 1 || dayOfWeek > 6) continue;
            applyExistingDayToRotationState(
                dateStr,
                existingShifts,
                rotationStaff,
                dayOfWeek >= 1 && dayOfWeek <= 5 ? earlyPattern : null,
                dayOfWeek === 6 ? saturdayPattern : latePattern,
                state,
                dayOfWeek === 6
            );
            continue;
        }

        const effectiveClosedDays = individuallyOpen ? closedDays.filter(day => day !== dayOfWeek && day !== 7) : closedDays;
        const effectiveHoliday = individuallyOpen ? false : holidays.includes(dateStr);
        const available = rotationStaff.filter(s => isStaffAvailable(s, date, dateStr, preferences, effectiveClosedDays, effectiveHoliday));
        if (available.length === 0) continue;

        if (dayOfWeek === 6) {
            assignSaturdayShifts(
                date, dateStr, available, settings, saturdayPattern, classes,
                generatedShifts, currentHours, currentWeeklyHours, state,
                breakSettings, sortBySaturdayPriority, preferences, existingShifts
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
