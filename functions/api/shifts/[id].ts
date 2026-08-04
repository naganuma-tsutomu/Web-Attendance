import { handleServerError, createValidationError, validateTimeFormat, validateTimeRange } from '../../utils/validation';
import type { Env, D1BindParam, D1Row } from '../../types';
import { loadStaffShiftsForDates, validateNoShiftConflicts } from '../../utils/shiftIntegrity';
import { writeAuditLog } from '../../utils/auditLog';
import { ShiftUpdateSchema } from '../../../shared/shiftRequestSchemas';

// shifts テーブルで更新を許可するカラム名のホワイトリスト
const ALLOWED_SHIFT_COLUMNS = new Set([
    'staffId', 'startTime', 'endTime', 'classType', 'isEarlyShift', 'isError', 'duty_number',
]);

/**
 * setClauses に追加する前にカラム名がホワイトリストに含まれているか検証する。
 * 不正なカラム名が検出された場合は例外をスローする。
 */
const addSetClause = (setClauses: string[], bindings: D1BindParam[], column: string, value: D1BindParam) => {
    if (!ALLOWED_SHIFT_COLUMNS.has(column)) {
        throw new Error(`Invalid column name: ${column}`);
    }
    setClauses.push(`${column} = ?`);
    bindings.push(value);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = ShiftUpdateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('シフトの入力内容が不正です');
        const body = parsed.data;

        const current = await context.env.DB.prepare(
            `SELECT id, date, staffId, startTime, endTime, classType, isError
             FROM shifts WHERE id = ?`
        ).bind(id).first<D1Row>();
        if (!current) {
            return new Response(JSON.stringify({ error: 'シフトが見つかりません' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (body.startTime !== undefined) {
            const error = validateTimeFormat(body.startTime, '開始時間');
            if (error) return createValidationError(error);
        }
        if (body.endTime !== undefined) {
            const error = validateTimeFormat(body.endTime, '終了時間');
            if (error) return createValidationError(error);
        }
        const mergedShift = {
            id,
            date: String(current.date),
            staffId: body.staffId ?? String(current.staffId),
            startTime: body.startTime ?? String(current.startTime),
            endTime: body.endTime ?? String(current.endTime),
            classType: body.classType ?? String(current.classType),
            isError: body.isError ?? (current.isError === 1 || current.isError === true),
        };
        const timeError = validateTimeRange(mergedShift.startTime, mergedShift.endTime);
        if (timeError) return createValidationError(timeError);
        if (!mergedShift.staffId.trim()) return createValidationError('staffId は必須です');
        if (!mergedShift.classType.trim()) return createValidationError('classType は必須です');

        const existingShifts = await loadStaffShiftsForDates(context.env.DB, [mergedShift], id);
        const conflictResponse = validateNoShiftConflicts([...existingShifts, mergedShift]);
        if (conflictResponse) return conflictResponse;

        // addSetClause() でホワイトリスト検証済みのカラム名のみ追加
        const setClauses: string[] = [];
        const bindings: D1BindParam[] = [];

        if (body.staffId !== undefined) {
            addSetClause(setClauses, bindings, 'staffId', body.staffId);
        }
        if (body.startTime !== undefined) {
            addSetClause(setClauses, bindings, 'startTime', body.startTime);
        }
        if (body.endTime !== undefined) {
            addSetClause(setClauses, bindings, 'endTime', body.endTime);
        }
        if (body.classType !== undefined) {
            addSetClause(setClauses, bindings, 'classType', body.classType);
        }
        if (body.isEarlyShift !== undefined) {
            addSetClause(setClauses, bindings, 'isEarlyShift', body.isEarlyShift ? 1 : 0);
        }
        if (body.isError !== undefined) {
            addSetClause(setClauses, bindings, 'isError', body.isError ? 1 : 0);
        }
        if (body.duty_number !== undefined) {
            addSetClause(setClauses, bindings, 'duty_number', body.duty_number);
        }

        if (setClauses.length === 0) {
            return createValidationError('更新するフィールドがありません');
        }

        bindings.push(id);
        await context.env.DB.prepare(
            `UPDATE shifts SET ${setClauses.join(', ')} WHERE id = ?`
        ).bind(...bindings).run();

        await writeAuditLog(context.env, context.request, { action: 'update', entityType: 'shift', entityId: id, yearMonth: String(current.date).slice(0, 7), targetDate: String(current.date), summary: 'シフトを更新', before: current, after: mergedShift });

        return Response.json({ success: true, message: 'Updated' });
    } catch (e) {
        // duty_number の UNIQUE 制約違反は 409 で返す（H2）
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed') && e.message.includes('duty_number')) {
            return new Response(JSON.stringify({ error: '同じ日付・クラスに同じ当番番号が既に存在します' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return handleServerError(e, 'Database error updating shift');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const current = await context.env.DB.prepare('SELECT * FROM shifts WHERE id = ?').bind(id).first<D1Row>();
        if (!current) return new Response(JSON.stringify({ error: 'シフトが見つかりません' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        await context.env.DB.prepare(
            'DELETE FROM shifts WHERE id = ?'
        ).bind(id).run();
        await writeAuditLog(context.env, context.request, { action: 'delete', entityType: 'shift', entityId: id, yearMonth: String(current.date).slice(0, 7), targetDate: String(current.date), summary: 'シフトを削除', before: current });
        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shift');
    }
};
