import { createValidationError, handleServerError, validateDate, validateTimeRange, validateYearMonth } from '../../utils/validation';
import type { Env } from '../../types';
import { validateNoShiftConflicts } from '../../utils/shiftIntegrity';
import { writeAuditLog } from '../../utils/auditLog';
import { ShiftReplaceSchema } from '../../../shared/shiftRequestSchemas';

type ReplacementShift = {
    date: string;
    staffId: string;
    classType: string;
    startTime: string;
    endTime: string;
    isEarlyShift?: boolean;
    isError?: boolean;
    duty_number?: number | null;
};

const validateShiftPayload = (shift: ReplacementShift, index: number, yearMonth: string): string | null => {
    const prefix = `shifts[${index}]`;
    const dateError = validateDate(shift.date, `${prefix}.date`);
    if (dateError) return dateError;
    if (!shift.date.startsWith(yearMonth)) return `${prefix}.date は対象月の範囲内で指定してください`;
    if (!shift.staffId || String(shift.staffId).trim().length === 0) return `${prefix}.staffId は必須です`;
    if (!shift.classType || String(shift.classType).trim().length === 0) return `${prefix}.classType は必須です`;
    const timeError = validateTimeRange(shift.startTime, shift.endTime);
    if (timeError) return `${prefix}: ${timeError}`;
    if (shift.duty_number !== undefined && shift.duty_number !== null && (!Number.isInteger(shift.duty_number) || shift.duty_number < 1)) {
        return `${prefix}.duty_number は1以上の整数で指定してください`;
    }
    return null;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ShiftReplaceSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('シフト置換の入力内容が不正です');
        const body = parsed.data;
        const replacementToken = crypto.randomUUID();

        const ymError = validateYearMonth(body.yearMonth);
        if (ymError) return createValidationError(ymError);
        const yearMonth = body.yearMonth!;
        const fixedDates = Array.from(new Set(body.fixedDates ?? []))
            .filter(date => date.startsWith(yearMonth));
        const fixedDateSet = new Set(fixedDates);
        const shifts = body.shifts ?? [];

        if (!Array.isArray(shifts)) return createValidationError('shifts は配列で指定してください');

        const insertableShifts = shifts.filter(shift => !fixedDateSet.has(shift.date));
        const dutyNumbers = new Set<string>();
        for (let i = 0; i < insertableShifts.length; i++) {
            const error = validateShiftPayload(insertableShifts[i], i, yearMonth);
            if (error) return createValidationError(error);
            const dutyNumber = insertableShifts[i].duty_number;
            if (dutyNumber !== undefined && dutyNumber !== null) {
                const key = `${insertableShifts[i].date}:${insertableShifts[i].classType}:${dutyNumber}`;
                if (dutyNumbers.has(key)) {
                    return new Response(JSON.stringify({ error: '同じ日付・クラスに同じ当番番号が既に存在します' }), {
                        status: 409,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                dutyNumbers.add(key);
            }
        }
        const conflictResponse = validateNoShiftConflicts(insertableShifts);
        if (conflictResponse) return conflictResponse;

        const [y, m] = yearMonth.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const countQuery = fixedDates.length > 0
            ? context.env.DB.prepare(
                `SELECT COUNT(*) AS count
                 FROM shifts WHERE date >= ? AND date < ? AND date NOT IN (${fixedDates.map(() => '?').join(',')})`
            ).bind(startStr, nextMonth, ...fixedDates)
            : context.env.DB.prepare(
                `SELECT COUNT(*) AS count
                 FROM shifts WHERE date >= ? AND date < ?`
            ).bind(startStr, nextMonth);
        const countRow = await countQuery.first<{ count: number }>();
        const beforeCount = Number(countRow?.count ?? 0);

        const statements = [
            context.env.DB.prepare(
                `INSERT OR IGNORE INTO shift_month_versions (year_month, version, lock_token)
                 VALUES (?, 0, NULL)`
            ).bind(yearMonth),
            context.env.DB.prepare(
                `UPDATE shift_month_versions SET lock_token = ?
                 WHERE year_month = ? AND version = ? AND lock_token IS NULL`
            ).bind(replacementToken, yearMonth, body.expectedVersion),
        ];
        if (fixedDates.length > 0) {
            const placeholders = fixedDates.map(() => '?').join(',');
            statements.push(
                context.env.DB.prepare(
                    `DELETE FROM shifts WHERE date >= ? AND date < ? AND date NOT IN (${placeholders})
                     AND EXISTS (SELECT 1 FROM shift_month_versions WHERE year_month = ? AND lock_token = ?)`
                ).bind(startStr, nextMonth, ...fixedDates, yearMonth, replacementToken)
            );
        } else {
            statements.push(
                context.env.DB.prepare(
                    `DELETE FROM shifts WHERE date >= ? AND date < ?
                     AND EXISTS (SELECT 1 FROM shift_month_versions WHERE year_month = ? AND lock_token = ?)`
                ).bind(startStr, nextMonth, yearMonth, replacementToken)
            );
        }

        if (insertableShifts.length > 0) {
            const rows = insertableShifts.map(shift => ({
                id: `shift_${crypto.randomUUID()}`,
                ...shift,
                isEarlyShift: shift.isEarlyShift ? 1 : 0,
                isError: shift.isError ? 1 : 0,
                duty_number: shift.duty_number ?? null,
            }));
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

        // D1 batch is transactional. Keeping DELETE and every INSERT in one batch
        // prevents a partially replaced month if any statement fails.
        const results = await context.env.DB.batch(statements);
        if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
            return new Response(JSON.stringify({ error: 'シフトが他の操作で更新されています。再読み込みしてから保存してください' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        await writeAuditLog(context.env, context.request, { action: 'replace', entityType: 'shift_month', yearMonth, summary: `${yearMonth}のシフトを一括置換`, metadata: { beforeCount, afterCount: insertableShifts.length, fixedDateCount: fixedDates.length } });
        return Response.json({ success: true, message: `Replaced ${insertableShifts.length} shifts` });
    } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed') && e.message.includes('duty_number')) {
            return new Response(JSON.stringify({ error: '同じ日付・クラスに同じ当番番号が既に存在します' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return handleServerError(e, 'POST /shifts/replace');
    }
};
