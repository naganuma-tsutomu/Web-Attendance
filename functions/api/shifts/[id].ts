import { handleServerError, createValidationError } from '../../utils/validation';
import type { Env, D1BindParam } from '../../types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as Partial<{
            staffId: string; startTime: string; endTime: string;
            classType: string; isEarlyShift: boolean; isError: boolean;
        }>;

        const setClauses: string[] = [];
        const bindings: D1BindParam[] = [];

        if (body.staffId !== undefined) {
            setClauses.push('staffId = ?');
            bindings.push(body.staffId);
        }
        if (body.startTime !== undefined) {
            setClauses.push('startTime = ?');
            bindings.push(body.startTime);
        }
        if (body.endTime !== undefined) {
            setClauses.push('endTime = ?');
            bindings.push(body.endTime);
        }
        if (body.classType !== undefined) {
            setClauses.push('classType = ?');
            bindings.push(body.classType);
        }
        if (body.isEarlyShift !== undefined) {
            setClauses.push('isEarlyShift = ?');
            bindings.push(body.isEarlyShift ? 1 : 0);
        }
        if (body.isError !== undefined) {
            setClauses.push('isError = ?');
            bindings.push(body.isError ? 1 : 0);
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
