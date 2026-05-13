import { UNASSIGNED_STAFF_ID } from '../../../constants';
import { calculateTotalHours } from '../../../utils/timeUtils';
import type { BreakSettings, GenerationReport, Shift, ShiftClass, Staff } from '../../../types';

export const buildGenerationReport = ({
    yearMonth,
    shifts,
    staffList,
    classes,
    fixedDateCount,
    breakSettings,
}: {
    yearMonth: string;
    shifts: Shift[];
    staffList: Staff[];
    classes: ShiftClass[];
    fixedDateCount: number;
    breakSettings?: BreakSettings;
}): GenerationReport => {
    const classNameMap = new Map(classes.map(cls => [cls.id, cls.name]));
    const hoursByStaff = calculateTotalHours(shifts, breakSettings);

    const unassignedRows = shifts
        .filter(shift => shift.isError || shift.staffId === UNASSIGNED_STAFF_ID)
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
        .map(shift => ({
            id: shift.id,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            className: classNameMap.get(shift.classType) ?? shift.classType,
        }));

    const staffRows = [...staffList]
        .map(staff => {
            const actualHours = hoursByStaff[staff.id] ?? 0;
            const targetHours = staff.hoursTarget ?? null;
            return {
                staffId: staff.id,
                staffName: staff.name,
                actualHours,
                targetHours,
                diffHours: targetHours !== null ? actualHours - targetHours : null,
            };
        })
        .sort((a, b) => {
            const absA = Math.abs(a.diffHours ?? 0);
            const absB = Math.abs(b.diffHours ?? 0);
            return absB - absA;
        });

    const classRows = classes.map(cls => {
        const classShifts = shifts.filter(shift => shift.classType === cls.id);
        const totalCount = classShifts.length;
        const assignedCount = classShifts.filter(shift => !shift.isError && shift.staffId !== UNASSIGNED_STAFF_ID).length;
        return {
            classId: cls.id,
            className: cls.name,
            assignedCount,
            totalCount,
            fillRate: totalCount > 0 ? assignedCount / totalCount : 1,
        };
    });

    return {
        yearMonth,
        generatedAt: new Date().toISOString(),
        generatedCount: shifts.length,
        unassignedCount: unassignedRows.length,
        fixedDateCount,
        unassignedRows,
        staffRows,
        classRows,
    };
};
