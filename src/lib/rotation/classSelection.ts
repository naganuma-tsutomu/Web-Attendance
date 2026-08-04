import type { Shift, ShiftClass, Staff } from '../../types';
import type { RotationState } from './types';

export const pickClassForRotation = (
    staff: Staff,
    classes: ShiftClass[],
    generatedShifts: Shift[],
    dateStr: string,
    state: RotationState
): string | null => {
    const autoAllocatableClasses = classes.filter(item => item.auto_allocate !== 0);
    const eligibleClasses = staff.classIds?.length
        ? autoAllocatableClasses.filter(item => staff.classIds?.includes(item.id))
        : autoAllocatableClasses;
    if (eligibleClasses.length === 0) return null;
    if (eligibleClasses.length === 1) return eligibleClasses[0].id;

    return eligibleClasses.map(item => ({
        id: item.id,
        displayOrder: item.display_order,
        dailyCount: generatedShifts.filter(shift => shift.date === dateStr && shift.classType === item.id).length,
        monthlyCount: state.classAssignmentCount[item.id] || 0,
        staffCount: state.staffClassAssignmentCount[staff.id]?.[item.id] || 0,
        lastDate: state.lastClassAssignmentDate[item.id] || '2000-01-01',
    })).sort((a, b) =>
        a.dailyCount - b.dailyCount || a.monthlyCount - b.monthlyCount ||
        a.staffCount - b.staffCount || a.lastDate.localeCompare(b.lastDate) ||
        a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)
    )[0].id;
};
