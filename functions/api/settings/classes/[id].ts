export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateName } from '../../../utils/validation';

// PUT /api/settings/classes/[id] — クラス更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as { name?: string, display_order?: number, auto_allocate?: number, color?: string };

        // Validate name if provided
        if (body.name !== undefined) {
            const nameError = validateName(body.name, 'クラス名', 50);
            if (nameError) return createValidationError(nameError);
        }

        let query = 'UPDATE classes SET ';
        const sets: string[] = [];
        const params: any[] = [];

        if (body.name !== undefined) {
            sets.push('name = ?');
            params.push(body.name.trim());
        }
        if (body.display_order !== undefined) {
            sets.push('display_order = ?');
            params.push(body.display_order);
        }
        if (body.auto_allocate !== undefined) {
            sets.push('auto_allocate = ?');
            params.push(body.auto_allocate);
        }
        if (body.color !== undefined) {
            sets.push('color = ?');
            params.push(body.color);
        }

        if (sets.length === 0) {
            return createValidationError('更新するデータがありません');
        }

        query += sets.join(', ') + ' WHERE id = ?';
        params.push(id);

        await context.env.DB.prepare(query).bind(...params).run();
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating class');
    }
};

// DELETE /api/settings/classes/[id] — クラス削除
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id).run();
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting class');
    }
};
