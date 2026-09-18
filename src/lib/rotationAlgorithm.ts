import { format, getDay } from 'date-fns';
import type { Staff, ShiftPreference, Shift, DynamicRole, ShiftClass, ShiftTimePattern, RotationSettings, BreakSettings, BusinessDayOverride } from '../types';
import { isStaffAvailable } from './availabilityUtils';
import type { RotationState } from './rotation/types';
import { applyExistingDayToRotationState, restorePreviousMonthState } from './rotation/state';
import { createRotationPriorityComparators } from './rotation/priority';
import { addRotationShift } from './rotation/shiftCreation';

export type { RotationState } from './rotation/types';
export { applyExistingDayToRotationState, restorePreviousMonthState } from './rotation/state';

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

    const { sortByEarlyPriority, sortByLatePriority, sortBySaturdayPriority } =
        createRotationPriorityComparators(state, currentHours);

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
