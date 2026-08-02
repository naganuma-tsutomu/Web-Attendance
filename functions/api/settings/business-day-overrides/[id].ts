import { createValidationError, handleServerError, validateName } from '../../../utils/validation';
import type { Env } from '../../../types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as { status?: string; name?: string };
        if (body.status !== undefined && body.status !== 'open' && body.status !== 'closed') {
            return createValidationError('営業状態はopenまたはclosedで指定してください');
        }
        if (body.name !== undefined) {
            const error = validateName(body.name, '名称', 100);
            if (error) return createValidationError(error);
        }
        if (body.status === undefined && body.name === undefined) {
            return createValidationError('更新するデータがありません');
        }

        const sets: string[] = [];
        const params: string[] = [];
        if (body.status !== undefined) { sets.push('status = ?'); params.push(body.status); }
        if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name.trim()); }
        sets.push("updated_at = datetime('now')");
        params.push(id);
        const result = await context.env.DB.prepare(
            `UPDATE business_day_overrides SET ${sets.join(', ')} WHERE id = ?`
        ).bind(...params).run();
        if (!result.meta.changes) return Response.json({ error: '個別設定が見つかりません' }, { status: 404 });
        return new Response(null, { status: 204 });
    } catch (e) {
        return handleServerError(e, 'Database error updating business day override');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const result = await context.env.DB.prepare(
            'DELETE FROM business_day_overrides WHERE id = ?'
        ).bind(context.params.id as string).run();
        if (!result.meta.changes) return Response.json({ error: '個別設定が見つかりません' }, { status: 404 });
        return new Response(null, { status: 204 });
    } catch (e) {
        return handleServerError(e, 'Database error deleting business day override');
    }
};
