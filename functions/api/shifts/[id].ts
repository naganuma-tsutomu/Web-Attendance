import { handleServerError, createValidationError } from '../../utils/validation';
import type { Env, D1BindParam } from '../../types';

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
        const body = await context.request.json() as Partial<{
            staffId: string; startTime: string; endTime: string;
            classType: string; isEarlyShift: boolean; isError: boolean;
            duty_number: number | null;
        }>;

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

        return Response.json({ success: true, message: 'Updated' });
    } catch (e) {
        return handleServerError(e, 'Database error updating shift');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare(
            'DELETE FROM shifts WHERE id = ?'
        ).bind(id).run();
        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shift');
    }
};
