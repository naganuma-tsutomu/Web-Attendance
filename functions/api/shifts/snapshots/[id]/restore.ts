import { createValidationError, handleServerError, validateYearMonth } from '../../../../utils/validation';
import type { Env, D1Row } from '../../../../types';
import { parseSnapshotFixedDates, parseSnapshotShifts } from '../index';
import { validateNoShiftConflicts } from '../../../../utils/shiftIntegrity';
import { writeAuditLog } from '../../../../utils/auditLog';

const SNAPSHOT_KEEP_LIMIT = 20;

const normalizeShiftRow = (row: D1Row) => ({
    date: String(row.date),
    staffId: String(row.staffId),
    startTime: String(row.startTime),
    endTime: String(row.endTime),
    classType: String(row.classType),
    isEarlyShift: row.isEarlyShift === 1 || row.isEarlyShift === true,
    isError: row.isError === 1 || row.isError === true,
    duty_number: typeof row.duty_number === 'number' ? row.duty_number : null,
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        if (!id) return createValidationError('snapshot id は必須です');

        const row = await context.env.DB.prepare(
            `SELECT yearMonth, shifts_json, fixed_dates_json
             FROM shift_snapshots
             WHERE id = ?`
        ).bind(id).first<D1Row>();

        if (!row) {
            return new Response(JSON.stringify({ error: 'バックアップが見つかりません' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const yearMonth = String(row.yearMonth);
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const shifts = parseSnapshotShifts(String(row.shifts_json));
        const restorableShifts = shifts.filter(shift => shift.date.startsWith(yearMonth));
        const conflictResponse = validateNoShiftConflicts(restorableShifts);
        if (conflictResponse) return conflictResponse;
        const fixedDates = parseSnapshotFixedDates(row.fixed_dates_json ? String(row.fixed_dates_json) : '[]')
            .filter(date => date.startsWith(yearMonth));

        const [y, m] = yearMonth.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const [{ results: currentShiftRows }, { results: currentFixedRows }] = await Promise.all([
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

        const preRestoreSnapshotId = `snapshot_${crypto.randomUUID()}`;
        const currentShifts = (currentShiftRows as D1Row[]).map(normalizeShiftRow);
        const currentFixedDates = (currentFixedRows as D1Row[]).map(row => String(row.date));

        const statements = [
            context.env.DB.prepare(
                `INSERT INTO shift_snapshots
                 (id, yearMonth, label, reason, shifts_json, fixed_dates_json, shift_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                preRestoreSnapshotId,
                yearMonth,
                '復元前の自動バックアップ',
                'restore-before',
                JSON.stringify(currentShifts),
                JSON.stringify(currentFixedDates),
                currentShifts.length
            ),
            context.env.DB.prepare('DELETE FROM shifts WHERE date >= ? AND date < ?').bind(startStr, nextMonth),
            context.env.DB.prepare('DELETE FROM fixed_dates WHERE yearMonth = ?').bind(yearMonth),
        ];

        if (restorableShifts.length > 0) {
            const rows = restorableShifts.map(shift => ({
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
            statements.push(
                context.env.DB.prepare(
                    `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError, duty_number)
                     SELECT
                         json_extract(value, '$.id'), json_extract(value, '$.date'),
                         json_extract(value, '$.staffId'), json_extract(value, '$.startTime'),
                         json_extract(value, '$.endTime'), json_extract(value, '$.classType'),
                         json_extract(value, '$.isEarlyShift'), json_extract(value, '$.isError'),
                         json_extract(value, '$.duty_number')
                     FROM json_each(?)`
                ).bind(JSON.stringify(rows))
            );
        }

        if (fixedDates.length > 0) {
            statements.push(
                context.env.DB.prepare(
                    `INSERT OR REPLACE INTO fixed_dates (date, yearMonth)
                     SELECT value, ? FROM json_each(?)`
                ).bind(yearMonth, JSON.stringify(fixedDates))
            );
        }

        statements.push(
            context.env.DB.prepare(
                `DELETE FROM shift_snapshots
                 WHERE yearMonth = ?
                   AND id NOT IN (
                     SELECT id FROM shift_snapshots
                     WHERE yearMonth = ?
                     ORDER BY created_at DESC, id DESC
                     LIMIT ?
                   )`
            ).bind(yearMonth, yearMonth, SNAPSHOT_KEEP_LIMIT)
        );

        // D1 batch is transactional. The pre-restore backup, deletion, complete
        // replacement and retention cleanup must commit or roll back together.
        await context.env.DB.batch(statements);

        await writeAuditLog(context.env, context.request, { action: 'restore', entityType: 'shift_snapshot', entityId: id, yearMonth, summary: `${yearMonth}のバックアップを復元`, metadata: { restoredShiftCount: restorableShifts.length, restoredFixedDateCount: fixedDates.length, preRestoreSnapshotId } });

        return Response.json({
            success: true,
            yearMonth,
            restoredShiftCount: restorableShifts.length,
            restoredFixedDateCount: fixedDates.length,
            preRestoreSnapshotId,
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed') && e.message.includes('duty_number')) {
            return new Response(JSON.stringify({ error: '復元対象のバックアップ内で同じ日付・クラスの当番番号が重複しています' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return handleServerError(e, 'POST /shifts/snapshots/:id/restore');
    }
};
