import { format } from 'date-fns';
import type { Shift, ShiftTimePattern, Staff } from '../../types';
import type { RotationState } from './types';

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
        if (shift.date !== dateStr || shift.isError || !rotationStaffIds.has(shift.staffId)) continue;

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
                state.saturdayShiftCount[shift.staffId] = (state.saturdayShiftCount[shift.staffId] || 0) + 1;
            }
            recordClassAssignment(state, shift.staffId, shift.classType, dateStr);
        }
    }

    state.previousDayEarly = [...earlyAssigned];
    state.previousDayLate = [...lateAssigned];
};

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
    const previousShifts = existingShifts.filter(shift =>
        shift.date < firstDateStr && !shift.isError && rotationStaffIds.has(shift.staffId) && (
            matchesPattern(shift, earlyPattern) || matchesPattern(shift, latePattern) ||
            Boolean(saturdayPattern && matchesPattern(shift, saturdayPattern))
        )
    );
    if (previousShifts.length === 0) return;

    const sortedDates = [...new Set(previousShifts.map(shift => shift.date))].sort();
    const lastWorkingDay = sortedDates[sortedDates.length - 1];

    for (const shift of previousShifts) {
        if (matchesPattern(shift, earlyPattern)) {
            if (!state.lastEarlyShift[shift.staffId] || shift.date > state.lastEarlyShift[shift.staffId]) {
                state.lastEarlyShift[shift.staffId] = shift.date;
            }
            if (shift.date === lastWorkingDay) state.previousDayEarly.push(shift.staffId);
        } else if (matchesPattern(shift, latePattern) || Boolean(saturdayPattern && matchesPattern(shift, saturdayPattern))) {
            if (!state.lastLateShift[shift.staffId] || shift.date > state.lastLateShift[shift.staffId]) {
                state.lastLateShift[shift.staffId] = shift.date;
            }
            if (shift.date === lastWorkingDay) state.previousDayLate.push(shift.staffId);
        }
    }
};
