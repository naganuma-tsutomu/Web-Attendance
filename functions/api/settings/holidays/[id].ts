import { handleServerError, createValidationError, validateName } from '../../../utils/validation';
import type { D1BindParam, Env } from '../../../types';
import { HolidayUpdateSchema } from '../../../../shared/calendarRequestSchemas';

// PUT /api/holidays/:id — 祝日更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = HolidayUpdateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('祝日の入力内容が不正です');
        const body = parsed.data;
        
        // Validate name if provided
        if (body.name !== undefined) {
            const nameError = validateName(body.name, '祝日名', 100);
            if (nameError) return createValidationError(nameError);
        }
        
        let query = 'UPDATE holidays SET ';
        const sets: string[] = [];
        const params: D1BindParam[] = [];
        
        if (body.name !== undefined) {
            sets.push('name = ?');
            params.push(body.name.trim());
        }
        if (body.type !== undefined) {
            sets.push('type = ?');
            params.push(body.type);
        }
        if (body.isWorkday !== undefined) {
            sets.push('is_workday = ?');
            params.push(body.isWorkday ? 1 : 0);
        }
        
        if (sets.length === 0) {
            return createValidationError('更新するデータがありません');
        }
        
        sets.push('updated_at = datetime(\'now\')');
        query += sets.join(', ') + ' WHERE id = ?';
        params.push(id);
        
        const result = await context.env.DB.prepare(query).bind(...params).run();
        if (!result.meta.changes) {
            return Response.json({ error: '祝日が見つかりません' }, { status: 404 });
        }
        return new Response(null, { status: 204 });
    } catch (e) { 
        return handleServerError(e, 'Database error updating holiday'); 
    }
};

// DELETE /api/holidays/:id — 祝日削除
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const result = await context.env.DB.prepare('DELETE FROM holidays WHERE id = ?').bind(id).run();
        if (!result.meta.changes) {
            return Response.json({ error: '祝日が見つかりません' }, { status: 404 });
        }
        return new Response(null, { status: 204 });
    } catch (e) { 
        return handleServerError(e, 'Database error deleting holiday'); 
    }
};
