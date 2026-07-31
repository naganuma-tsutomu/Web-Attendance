import {
    createShiftConflictResponse,
    findShiftConflict,
    type ShiftTimeRange,
} from '../../shared/shiftIntegrity';
import type { D1Row, Env } from '../types';

export type PersistedShift = ShiftTimeRange & {
    id?: string;
    classType: string;
};

export const validateNoShiftConflicts = (shifts: PersistedShift[]): Response | null => {
    const conflict = findShiftConflict(shifts);
    return conflict ? createShiftConflictResponse(conflict) : null;
};

export const loadStaffShiftsForDates = async (
    db: Env['DB'],
    shifts: PersistedShift[],
    excludedId?: string
): Promise<PersistedShift[]> => {
    const keys = new Map<string, { date: string; staffId: string }>();
    for (const shift of shifts) {
        if (!shift.staffId || shift.staffId === 'UNASSIGNED' || shift.isError) continue;
        keys.set(`${shift.date}\u0000${shift.staffId}`, {
            date: shift.date,
            staffId: shift.staffId,
        });
    }

    const rows = await Promise.all([...keys.values()].map(async ({ date, staffId }) => {
        const statement = excludedId
            ? db.prepare(
                `SELECT id, date, staffId, startTime, endTime, classType, isError
                 FROM shifts
                 WHERE date = ? AND staffId = ? AND id <> ? AND isError = 0`
            ).bind(date, staffId, excludedId)
            : db.prepare(
                `SELECT id, date, staffId, startTime, endTime, classType, isError
                 FROM shifts
                 WHERE date = ? AND staffId = ? AND isError = 0`
            ).bind(date, staffId);
        const result = await statement.all();
        return result.results as D1Row[];
    }));

    return rows.flat().map(row => ({
        id: String(row.id),
        date: String(row.date),
        staffId: String(row.staffId),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        classType: String(row.classType),
        isError: row.isError === 1 || row.isError === true,
    }));
};
