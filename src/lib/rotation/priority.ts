import type { Staff } from '../../types';
import type { RotationState } from './types';

export const createRotationPriorityComparators = (
    state: RotationState,
    currentHours: Record<string, number>
) => {
    const compareCommon = (a: Staff, b: Staff, shiftType: 'early' | 'late') => {
        const counts = shiftType === 'early' ? state.earlyShiftCount : state.lateShiftCount;
        const dates = shiftType === 'early' ? state.lastEarlyShift : state.lastLateShift;
        const countDiff = (counts[a.id] || 0) - (counts[b.id] || 0);
        if (countDiff !== 0) return countDiff;
        const dateDiff = (dates[a.id] || '2000-01-01').localeCompare(dates[b.id] || '2000-01-01');
        if (dateDiff !== 0) return dateDiff;
        const totalDiff =
            (state.earlyShiftCount[a.id] || 0) + (state.lateShiftCount[a.id] || 0) -
            (state.earlyShiftCount[b.id] || 0) - (state.lateShiftCount[b.id] || 0);
        if (totalDiff !== 0) return totalDiff;
        const hoursDiff = currentHours[a.id] - currentHours[b.id];
        if (hoursDiff !== 0) return hoursDiff;
        return (a.display_order ?? 0) - (b.display_order ?? 0) || a.id.localeCompare(b.id);
    };

    const sortByEarlyPriority = (a: Staff, b: Staff) => compareCommon(a, b, 'early');
    const sortByLatePriority = (a: Staff, b: Staff) => compareCommon(a, b, 'late');
    const sortBySaturdayPriority = (a: Staff, b: Staff) => {
        const countDiff = (state.saturdayShiftCount[a.id] || 0) - (state.saturdayShiftCount[b.id] || 0);
        if (countDiff !== 0) return countDiff;
        const dateDiff = (state.lastSaturdayShift[a.id] || '2000-01-01')
            .localeCompare(state.lastSaturdayShift[b.id] || '2000-01-01');
        return dateDiff || sortByLatePriority(a, b);
    };

    return { sortByEarlyPriority, sortByLatePriority, sortBySaturdayPriority };
};
