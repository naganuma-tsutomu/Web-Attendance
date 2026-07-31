import { createValidationError, handleServerError, validateYearMonth, validateDate, validateTimeRange } from '../../utils/validation';
import type { Env, D1Row } from '../../types';
import { loadStaffShiftsForDates, validateNoShiftConflicts } from '../../utils/shiftIntegrity';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth!.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE date >= ? AND date < ?"
        ).bind(startStr, nextMonth).all();

        const shifts = (results as D1Row[]).map((row) => ({
            ...row,
            isEarlyShift: row.isEarlyShift === 1,
            isError: row.isError === 1
        }));

        return Response.json(shifts);
    } catch (e) {
        return handleServerError(e, 'GET /shifts');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const shiftsData = await context.request.json() as Array<{
            date: string; staffId: string; classType: string;
            startTime: string; endTime: string; isEarlyShift?: boolean; isError?: boolean;
            duty_number?: number | null;
        }>;
        if (!shiftsData || shiftsData.length === 0) {
            return Response.json({ success: true, message: 'No data to insert' });
        }

        for (let i = 0; i < shiftsData.length; i++) {
            const shift = shiftsData[i];
            const prefix = `shifts[${i}]`;

            const dateError = validateDate(shift.date, `${prefix}.date`);
            if (dateError) return createValidationError(dateError);

            if (!shift.staffId || String(shift.staffId).trim().length === 0) {
                return createValidationError(`${prefix}.staffId は必須です`);
            }

            if (!shift.classType || String(shift.classType).trim().length === 0) {
                return createValidationError(`${prefix}.classType は必須です`);
            }

            const timeError = validateTimeRange(shift.startTime, shift.endTime);
            if (timeError) return createValidationError(`${prefix}: ${timeError}`);
        }

        const payloadConflict = validateNoShiftConflicts(shiftsData);
        if (payloadConflict) return payloadConflict;

        const existingShifts = await loadStaffShiftsForDates(context.env.DB, shiftsData);
        const existingConflict = validateNoShiftConflicts([...existingShifts, ...shiftsData]);
        if (existingConflict) return existingConflict;

        const stmt = context.env.DB.prepare(
            `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError, duty_number)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        // D1 batch limit is 100 statements. Split data into chunks of 100.
        const chunkSize = 100;
        const insertedIds: string[] = [];

        try {
            for (let i = 0; i < shiftsData.length; i += chunkSize) {
                const chunk = shiftsData.slice(i, i + chunkSize);
                const ids = chunk.map(() => `shift_${crypto.randomUUID()}`);
                const batch = chunk.map((shift, idx) => stmt.bind(
                    ids[idx],
                    shift.date,
                    shift.staffId,
                    shift.startTime,
                    shift.endTime,
                    shift.classType,
                    shift.isEarlyShift ? 1 : 0,
                    shift.isError ? 1 : 0,
                    shift.duty_number ?? null
                ));
                await context.env.DB.batch(batch);
                insertedIds.push(...ids);
            }
        } catch (batchError) {
            // 途中のチャンクが失敗した場合、挿入済みのシフトを削除してロールバック
            if (insertedIds.length > 0) {
                try {
                    const rollbackPlaceholders = insertedIds.map(() => '?').join(',');
                    await context.env.DB.prepare(
                        `DELETE FROM shifts WHERE id IN (${rollbackPlaceholders})`
                    ).bind(...insertedIds).run();
                } catch (rollbackError) {
                    console.error('Rollback failed:', rollbackError);
                }
            }
            // duty_number の UNIQUE 制約違反は 409 で返す（PUT 側と同様）
            if (batchError instanceof Error && batchError.message.includes('UNIQUE constraint failed') && batchError.message.includes('duty_number')) {
                return new Response(JSON.stringify({ error: '同じ日付・クラスに同じ当番番号が既に存在します' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw batchError;
        }

        return Response.json({ success: true, message: `Successfully inserted ${shiftsData.length} shifts` });
    } catch (e) {
        return handleServerError(e, 'POST /shifts');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth!.split('-').map(Number);
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        await context.env.DB.prepare(
            "DELETE FROM shifts WHERE date >= ? AND date < ?"
        ).bind(`${yearMonth}-01`, nextMonth).run();

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'DELETE /shifts');
    }
};
