import { createValidationError, handleServerError, validateYearMonth, validateDate, validateTimeRange } from '../../utils/validation';
import type { Env, D1Row } from '../../types';
import { loadStaffShiftsForDates, validateNoShiftConflicts } from '../../utils/shiftIntegrity';
import { writeAuditLog } from '../../utils/auditLog';
import { ShiftBatchCreateSchema } from '../../../shared/shiftRequestSchemas';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth!.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const [{ results }, versionRow] = await Promise.all([
            context.env.DB.prepare(
                "SELECT * FROM shifts WHERE date >= ? AND date < ?"
            ).bind(startStr, nextMonth).all(),
            context.env.DB.prepare(
                "SELECT version FROM shift_month_versions WHERE year_month = ?"
            ).bind(yearMonth).first<{ version: number }>(),
        ]);

        const shifts = (results as D1Row[]).map((row) => ({
            ...row,
            isEarlyShift: row.isEarlyShift === 1,
            isError: row.isError === 1
        }));

        return Response.json({ shifts, version: Number(versionRow?.version ?? 0) });
    } catch (e) {
        return handleServerError(e, 'GET /shifts');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ShiftBatchCreateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('シフトの入力内容が不正です');
        const shiftsData = parsed.data;
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

        const rows = shiftsData.map(shift => ({
            id: `shift_${crypto.randomUUID()}`,
            date: shift.date,
            staffId: shift.staffId,
            startTime: shift.startTime,
            endTime: shift.endTime,
            classType: shift.classType,
            isEarlyShift: shift.isEarlyShift ? 1 : 0,
            isError: shift.isError ? 1 : 0,
            duty_number: shift.duty_number ?? null,
        }));

        try {
            // 1つのINSERT文として実行するため、途中行で失敗しても全行がロールバックされる。
            await context.env.DB.prepare(
                `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError, duty_number)
                 SELECT
                    json_extract(value, '$.id'), json_extract(value, '$.date'),
                    json_extract(value, '$.staffId'), json_extract(value, '$.startTime'),
                    json_extract(value, '$.endTime'), json_extract(value, '$.classType'),
                    json_extract(value, '$.isEarlyShift'), json_extract(value, '$.isError'),
                    json_extract(value, '$.duty_number')
                 FROM json_each(?)`
            ).bind(JSON.stringify(rows)).run();
        } catch (insertError) {
            if (insertError instanceof Error && insertError.message.includes('UNIQUE constraint failed') && insertError.message.includes('duty_number')) {
                return new Response(JSON.stringify({ error: '同じ日付・クラスに同じ当番番号が既に存在します' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw insertError;
        }

        await writeAuditLog(context.env, context.request, { action: 'create', entityType: 'shift', yearMonth: shiftsData[0]?.date.slice(0, 7), summary: `${shiftsData.length}件のシフトを追加`, metadata: { count: shiftsData.length, ids: rows.map(row => row.id) } });
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
        const result = await context.env.DB.prepare(
            "DELETE FROM shifts WHERE date >= ? AND date < ?"
        ).bind(`${yearMonth}-01`, nextMonth).run();
        await writeAuditLog(context.env, context.request, { action: 'delete', entityType: 'shift_month', yearMonth, summary: `${yearMonth}のシフトを削除`, metadata: { count: result.meta.changes } });
        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'DELETE /shifts');
    }
};
