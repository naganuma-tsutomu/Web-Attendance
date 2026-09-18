import { format, startOfISOWeek } from 'date-fns';
import type { BreakSettings, Shift, ShiftClass, ShiftPreference, ShiftTimePattern, Staff } from '../../types';
import { timeRangesOverlap } from '../../utils/timeUtils';
import { calcDuration } from '../algorithm';
import { isStaffAvailableDuringTime } from '../availabilityUtils';
import { pickClassForRotation } from './classSelection';
import type { RotationState } from './types';

export const addRotationShift = (
    generatedShifts: Shift[], dateStr: string, date: Date, staff: Staff,
    pattern: ShiftTimePattern, classes: ShiftClass[], currentHours: Record<string, number>,
    currentWeeklyHours: Record<string, Record<string, number>>, shiftType: 'early' | 'late',
    state: RotationState, breakSettings?: BreakSettings, preferences: ShiftPreference[] = [],
    existingShifts: Shift[] = []
): boolean => {
    const classId = pickClassForRotation(staff, classes, generatedShifts, dateStr, state);
    if (!classId || !isStaffAvailableDuringTime(staff, date, dateStr, pattern.startTime, pattern.endTime, preferences)) return false;
    if ([...existingShifts, ...generatedShifts].some(shift =>
        shift.staffId === staff.id && shift.date === dateStr && !shift.isError &&
        timeRangesOverlap(pattern.startTime, pattern.endTime, shift.startTime, shift.endTime)
    )) return false;

    const duration = calcDuration(pattern.startTime, pattern.endTime, breakSettings);
    const staffCurrentHours = currentHours[staff.id] ?? 0;
    if (staff.hoursTarget != null && staffCurrentHours + duration > staff.hoursTarget) return false;
    const weekKey = `w-${format(startOfISOWeek(date), 'yyyy-MM-dd')}`;
    const currentWeekHours = currentWeeklyHours[staff.id]?.[weekKey] ?? 0;
    if (staff.weeklyHoursTarget != null && currentWeekHours + duration > staff.weeklyHoursTarget) return false;

    generatedShifts.push({ id: `rot_${dateStr}_${shiftType}_${staff.id}`, date: dateStr, staffId: staff.id,
        startTime: pattern.startTime, endTime: pattern.endTime, classType: classId });
    currentHours[staff.id] = staffCurrentHours + duration;
    if (!currentWeeklyHours[staff.id]) currentWeeklyHours[staff.id] = {};
    currentWeeklyHours[staff.id][weekKey] = currentWeekHours + duration;
    state.classAssignmentCount[classId] = (state.classAssignmentCount[classId] || 0) + 1;
    state.lastClassAssignmentDate[classId] = dateStr;
    if (!state.staffClassAssignmentCount[staff.id]) state.staffClassAssignmentCount[staff.id] = {};
    state.staffClassAssignmentCount[staff.id][classId] = (state.staffClassAssignmentCount[staff.id][classId] || 0) + 1;
    return true;
};
