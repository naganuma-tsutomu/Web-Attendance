export const UNASSIGNED_STAFF_ID_VALUE = 'UNASSIGNED';

export interface ShiftTimeRange {
    date: string;
    staffId: string;
    startTime: string;
    endTime: string;
    classType?: string;
    isError?: boolean | number | null;
    id?: string;
}

export interface ShiftConflict {
    first: ShiftTimeRange;
    second: ShiftTimeRange;
}

const timeToComparableMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export const timeRangesOverlap = (
    firstStart: string,
    firstEnd: string,
    secondStart: string,
    secondEnd: string
): boolean => {
    const firstStartMinutes = timeToComparableMinutes(firstStart);
    let firstEndMinutes = timeToComparableMinutes(firstEnd);
    const secondStartMinutes = timeToComparableMinutes(secondStart);
    let secondEndMinutes = timeToComparableMinutes(secondEnd);

    if (firstEndMinutes <= firstStartMinutes) firstEndMinutes += 24 * 60;
    if (secondEndMinutes <= secondStartMinutes) secondEndMinutes += 24 * 60;

    const overlaps = (shift: number) =>
        firstStartMinutes < secondEndMinutes + shift &&
        firstEndMinutes > secondStartMinutes + shift;

    return overlaps(0) || overlaps(24 * 60) || overlaps(-24 * 60);
};

const isAssignedShift = (shift: ShiftTimeRange): boolean =>
    Boolean(shift.staffId) &&
    shift.staffId !== UNASSIGNED_STAFF_ID_VALUE &&
    shift.isError !== true &&
    shift.isError !== 1;

export const findShiftConflict = (shifts: ShiftTimeRange[]): ShiftConflict | null => {
    const groups = new Map<string, ShiftTimeRange[]>();

    for (const shift of shifts) {
        if (!isAssignedShift(shift)) continue;
        const key = `${shift.date}\u0000${shift.staffId}`;
        const group = groups.get(key);
        if (group) group.push(shift);
        else groups.set(key, [shift]);
    }

    for (const group of groups.values()) {
        group.sort((a, b) =>
            a.startTime.localeCompare(b.startTime) ||
            a.endTime.localeCompare(b.endTime)
        );

        let latest = group[0];
        for (let index = 1; index < group.length; index++) {
            const current = group[index];
            if (timeRangesOverlap(
                latest.startTime,
                latest.endTime,
                current.startTime,
                current.endTime
            )) {
                return { first: latest, second: current };
            }
            if (current.endTime > latest.endTime) latest = current;
        }
    }

    return null;
};

export const createShiftConflictResponse = (conflict: ShiftConflict): Response =>
    new Response(JSON.stringify({
        error: '同じスタッフに重複する勤務時間が設定されています',
        conflict: {
            date: conflict.first.date,
            staffId: conflict.first.staffId,
            first: {
                startTime: conflict.first.startTime,
                endTime: conflict.first.endTime,
                classType: conflict.first.classType,
            },
            second: {
                startTime: conflict.second.startTime,
                endTime: conflict.second.endTime,
                classType: conflict.second.classType,
            },
        },
    }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
    });
