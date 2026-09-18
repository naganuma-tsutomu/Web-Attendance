import { createValidationError, handleServerError } from '../../../utils/validation';
import type { D1Row, Env } from '../../../types';
import { writeAuditLog } from '../../../utils/auditLog';
import { BusinessDayOverrideUpdateSchema } from '../../../../shared/calendarRequestSchemas';

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = BusinessDayOverrideUpdateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('個別営業日の入力内容が不正です');
        const body = parsed.data;
        if (body.status !== undefined && body.status !== 'open' && body.status !== 'closed') {
            return createValidationError('営業状態はopenまたはclosedで指定してください');
        }
        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || body.name.trim().length > 100) {
                return createValidationError('理由は100文字以内で入力してください');
            }
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
        const updated = context.env.ADMIN_PASSWORD
            ? await context.env.DB.prepare('SELECT * FROM business_day_overrides WHERE id = ?').bind(id).first<D1Row>()
            : null;
        await writeAuditLog(context.env, context.request, { action: 'update', entityType: 'business_day_override', entityId: id, yearMonth: updated ? String(updated.date).slice(0, 7) : null, targetDate: updated ? String(updated.date) : null, summary: '個別営業日・休業日を更新', after: updated ?? body });
        return new Response(null, { status: 204 });
    } catch (e) {
        return handleServerError(e, 'Database error updating business day override');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const current = context.env.ADMIN_PASSWORD
            ? await context.env.DB.prepare('SELECT * FROM business_day_overrides WHERE id = ?').bind(id).first<D1Row>()
            : null;
        const result = await context.env.DB.prepare(
            'DELETE FROM business_day_overrides WHERE id = ?'
        ).bind(id).run();
        if (!result.meta.changes) return Response.json({ error: '個別設定が見つかりません' }, { status: 404 });
        await writeAuditLog(context.env, context.request, { action: 'delete', entityType: 'business_day_override', entityId: id, yearMonth: current ? String(current.date).slice(0, 7) : null, targetDate: current ? String(current.date) : null, summary: '個別営業日・休業日を削除', before: current ?? undefined });
        return new Response(null, { status: 204 });
    } catch (e) {
        return handleServerError(e, 'Database error deleting business day override');
    }
};
