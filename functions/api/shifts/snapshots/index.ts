import { createValidationError, handleServerError, safeJsonParse, validateYearMonth } from '../../../utils/validation';
import type { Env, D1Row } from '../../../types';
import { ShiftSnapshotCreateSchema } from '../../../../shared/shiftRequestSchemas';

type SnapshotShift = {
    date: string;
    staffId: string;
    startTime: string;
    endTime: string;
    classType: string;
    isEarlyShift?: boolean;
    isError?: boolean;
    duty_number?: number | null;
};

const SNAPSHOT_KEEP_LIMIT = 20;

const normalizeShiftRow = (row: D1Row): SnapshotShift => ({
    date: String(row.date),
    staffId: String(row.staffId),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    classType: String(row.classType),
    isEarlyShift: row.isEarlyShift === 1 || row.isEarlyShift === true,
    isError: row.isError === 1 || row.isError === true,
    duty_number: typeof row.duty_number === 'number' ? row.duty_number : null,
});

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const { results } = await context.env.DB.prepare(
            `SELECT id, yearMonth, label, reason, shift_count, created_at
             FROM shift_snapshots
             WHERE yearMonth = ?
             ORDER BY created_at DESC`
        ).bind(yearMonth).all();

        return Response.json((results as D1Row[]).map(row => ({
            id: String(row.id),
            yearMonth: String(row.yearMonth),
            label: row.label ? String(row.label) : null,
            reason: String(row.reason),
            shiftCount: Number(row.shift_count ?? 0),
            createdAt: String(row.created_at),
        })));
    } catch (e) {
        return handleServerError(e, 'GET /shifts/snapshots');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ShiftSnapshotCreateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('スナップショットの入力内容が不正です');
        const body = parsed.data;
        const ymError = validateYearMonth(body.yearMonth);
        if (ymError) return createValidationError(ymError);
        const yearMonth = body.yearMonth!;
        const reason = (body.reason || 'manual').trim();
        if (!reason) return createValidationError('reason は必須です');

        const [y, m] = yearMonth.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const [{ results: shiftRows }, { results: fixedDateRows }] = await Promise.all([
            context.env.DB.prepare(
                `SELECT date, staffId, startTime, endTime, classType, isEarlyShift, isError, duty_number
                 FROM shifts
                 WHERE date >= ? AND date < ?
                 ORDER BY date, classType, startTime, staffId`
            ).bind(startStr, nextMonth).all(),
            context.env.DB.prepare(
                'SELECT date FROM fixed_dates WHERE yearMonth = ? ORDER BY date'
            ).bind(yearMonth).all(),
        ]);

        const shifts = (shiftRows as D1Row[]).map(normalizeShiftRow);
        const fixedDates = (fixedDateRows as D1Row[]).map(row => String(row.date));
        const id = `snapshot_${crypto.randomUUID()}`;
        const label = body.label?.trim() || null;

        await context.env.DB.prepare(
            `INSERT INTO shift_snapshots
             (id, yearMonth, label, reason, shifts_json, fixed_dates_json, shift_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            yearMonth,
            label,
            reason,
            JSON.stringify(shifts),
            JSON.stringify(fixedDates),
            shifts.length
        ).run();

        await context.env.DB.prepare(
            `DELETE FROM shift_snapshots
             WHERE yearMonth = ?
               AND id NOT IN (
                 SELECT id FROM shift_snapshots
                 WHERE yearMonth = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT ?
               )`
        ).bind(yearMonth, yearMonth, SNAPSHOT_KEEP_LIMIT).run();

        return Response.json({
            id,
            yearMonth,
            label,
            reason,
            shiftCount: shifts.length,
            fixedDateCount: fixedDates.length,
        });
    } catch (e) {
        return handleServerError(e, 'POST /shifts/snapshots');
    }
};

export const parseSnapshotShifts = (value: string): SnapshotShift[] => {
    const parsed = safeJsonParse<SnapshotShift[]>(value, []);
    return Array.isArray(parsed) ? parsed : [];
};

export const parseSnapshotFixedDates = (value: string | null | undefined): string[] => {
    const parsed = safeJsonParse<string[]>(value, []);
    return Array.isArray(parsed) ? parsed.filter(date => typeof date === 'string') : [];
};
