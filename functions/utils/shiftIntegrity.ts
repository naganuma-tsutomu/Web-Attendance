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

    if (keys.size === 0) return [];

    const serializedKeys = JSON.stringify([...keys.values()]);
    const statement = excludedId
        ? db.prepare(
            `WITH requested_keys AS (
                SELECT DISTINCT
                    json_extract(value, '$.date') AS date,
                    json_extract(value, '$.staffId') AS staffId
                FROM json_each(?)
             )
             SELECT s.id, s.date, s.staffId, s.startTime, s.endTime, s.classType, s.isError
             FROM shifts AS s
             INNER JOIN requested_keys AS requested
                ON requested.date = s.date AND requested.staffId = s.staffId
             WHERE s.id <> ? AND s.isError = 0`
        ).bind(serializedKeys, excludedId)
        : db.prepare(
            `WITH requested_keys AS (
                SELECT DISTINCT
                    json_extract(value, '$.date') AS date,
                    json_extract(value, '$.staffId') AS staffId
                FROM json_each(?)
             )
             SELECT s.id, s.date, s.staffId, s.startTime, s.endTime, s.classType, s.isError
             FROM shifts AS s
             INNER JOIN requested_keys AS requested
                ON requested.date = s.date AND requested.staffId = s.staffId
             WHERE s.isError = 0`
        ).bind(serializedKeys);
    const result = await statement.all();
    const rows = result.results as D1Row[];

    return rows.map(row => ({
        id: String(row.id),
        date: String(row.date),
        staffId: String(row.staffId),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        classType: String(row.classType),
        isError: row.isError === 1 || row.isError === true,
    }));
};
