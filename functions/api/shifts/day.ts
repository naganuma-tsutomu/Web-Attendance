import { ShiftDayReplaceSchema } from '../../../shared/shiftRequestSchemas';
import type { Env, D1Row } from '../../types';
import { validateNoShiftConflicts } from '../../utils/shiftIntegrity';
import { writeAuditLog } from '../../utils/auditLog';
import { createValidationError, handleServerError, validateDate, validateTimeRange } from '../../utils/validation';

type DayShift = {
    id?: string;
    date: string;
    staffId: string;
    classType: string;
    startTime: string;
    endTime: string;
    isEarlyShift?: boolean;
    isError?: boolean;
    duty_number?: number | null;
};

const conflictResponse = (message: string) => new Response(JSON.stringify({ error: message }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ShiftDayReplaceSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('日別シフトの入力内容が不正です');

        const { date, expectedVersion, shifts } = parsed.data;
        const dateError = validateDate(date);
        if (dateError) return createValidationError(dateError);
        const yearMonth = date.slice(0, 7);

        const dutyNumbers = new Set<string>();
        for (let index = 0; index < shifts.length; index++) {
            const shift = shifts[index];
            const timeError = validateTimeRange(shift.startTime, shift.endTime);
            if (timeError) return createValidationError(`shifts[${index}]: ${timeError}`);
            if (shift.duty_number !== undefined && shift.duty_number !== null) {
                const key = `${shift.classType}:${shift.duty_number}`;
                if (dutyNumbers.has(key)) {
                    return conflictResponse('同じ日付・クラスに同じ当番番号が既に存在します');
                }
                dutyNumbers.add(key);
            }
        }

        const overlap = validateNoShiftConflicts(shifts);
        if (overlap) return overlap;

        const beforeResult = await context.env.DB.prepare(
            `SELECT id, date, staffId, startTime, endTime, classType, isEarlyShift, isError, duty_number
             FROM shifts WHERE date = ?`
        ).bind(date).all<D1Row>();
        const beforeRows = beforeResult.results;
        const existingIds = new Set(beforeRows.map(row => String(row.id)));
        const unknownId = shifts.find(shift => shift.id && !existingIds.has(shift.id));
        if (unknownId) {
            return conflictResponse('シフトが他の操作で更新されています。再読み込みしてから保存してください');
        }

        const rows = shifts.map((shift: DayShift) => ({
            id: shift.id ?? `shift_${crypto.randomUUID()}`,
            date,
            staffId: shift.staffId,
            startTime: shift.startTime,
            endTime: shift.endTime,
            classType: shift.classType,
            isEarlyShift: shift.isEarlyShift ? 1 : 0,
            isError: shift.isError ? 1 : 0,
            duty_number: shift.duty_number ?? null,
        }));
        const replacementToken = crypto.randomUUID();
        const statements = [
            context.env.DB.prepare(
                `INSERT OR IGNORE INTO shift_month_versions (year_month, version, lock_token)
                 VALUES (?, 0, NULL)`
            ).bind(yearMonth),
            context.env.DB.prepare(
                `UPDATE shift_month_versions SET lock_token = ?
                 WHERE year_month = ? AND version = ? AND lock_token IS NULL`
            ).bind(replacementToken, yearMonth, expectedVersion),
            context.env.DB.prepare(
                `DELETE FROM shifts WHERE date = ?
                 AND EXISTS (SELECT 1 FROM shift_month_versions WHERE year_month = ? AND lock_token = ?)`
            ).bind(date, yearMonth, replacementToken),
        ];

        if (rows.length > 0) {
            statements.push(
                context.env.DB.prepare(
                    `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError, duty_number)
                     SELECT
                         json_extract(value, '$.id'), json_extract(value, '$.date'),
                         json_extract(value, '$.staffId'), json_extract(value, '$.startTime'),
                         json_extract(value, '$.endTime'), json_extract(value, '$.classType'),
                         json_extract(value, '$.isEarlyShift'), json_extract(value, '$.isError'),
                         json_extract(value, '$.duty_number')
                     FROM json_each(?)
                     WHERE EXISTS (
                         SELECT 1 FROM shift_month_versions WHERE year_month = ? AND lock_token = ?
                     )`
                ).bind(JSON.stringify(rows), yearMonth, replacementToken)
            );
        }

        statements.push(
            context.env.DB.prepare(
                `UPDATE shift_month_versions SET lock_token = NULL
                 WHERE year_month = ? AND lock_token = ?`
            ).bind(yearMonth, replacementToken)
        );

        // DELETE・INSERT・ロック解除を同じD1 batchに入れ、日別保存を原子的にする。
        const results = await context.env.DB.batch(statements);
        if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
            return conflictResponse('シフトが他の操作で更新されています。再読み込みしてから保存してください');
        }

        await writeAuditLog(context.env, context.request, {
            action: 'replace',
            entityType: 'shift_day',
            yearMonth,
            targetDate: date,
            summary: `${date}のシフトを一括保存`,
            before: beforeRows,
            after: rows,
            metadata: { beforeCount: beforeRows.length, afterCount: rows.length },
        });
        return Response.json({ success: true, message: `Replaced ${rows.length} shifts` });
    } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed') && error.message.includes('duty_number')) {
            return conflictResponse('同じ日付・クラスに同じ当番番号が既に存在します');
        }
        return handleServerError(error, 'POST /shifts/day');
    }
};
