import { createValidationError, handleServerError } from '../../../utils/validation';
import type { Env, D1Row } from '../../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        if (!id) return createValidationError('IDが指定されていません');

        const retired = await context.env.DB.prepare(
            'SELECT id FROM staffs WHERE id = ? AND retired_at IS NOT NULL'
        ).bind(id).first();
        if (!retired) return Response.json({ error: '退職者が見つかりません' }, { status: 404 });

        for (let attempt = 0; attempt < 5; attempt++) {
            const random = new Uint32Array(1);
            crypto.getRandomValues(random);
            const accessKey = (100000 + (random[0] % 900000)).toString();

            try {
                const result = await context.env.DB.prepare(
                    'UPDATE staffs SET retired_at = NULL, access_key = ? WHERE id = ? AND retired_at IS NOT NULL'
                ).bind(accessKey, id).run();
                if (result.meta.changes === 0) {
                    return Response.json({ error: '退職者が見つかりません' }, { status: 404 });
                }
                return Response.json({ success: true });
            } catch (error) {
                if (error instanceof Error && error.message.includes('UNIQUE constraint failed: staffs.access_key')) {
                    continue;
                }
                throw error;
            }
        }

        return Response.json({ error: 'アクセスキーの生成に失敗しました。再度お試しください。' }, { status: 500 });
    } catch (error) {
        return handleServerError(error, 'Database error restoring retired staff');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        if (!id) return createValidationError('IDが指定されていません');

        const retired = await context.env.DB.prepare(
            'SELECT id FROM staffs WHERE id = ? AND retired_at IS NOT NULL'
        ).bind(id).first();
        if (!retired) return Response.json({ error: '退職者が見つかりません' }, { status: 404 });

        const { results: snapshots } = await context.env.DB.prepare(
            'SELECT id, shifts_json FROM shift_snapshots WHERE shifts_json LIKE ?'
        ).bind(`%${id}%`).all();

        const statements = [];
        for (const snapshot of snapshots as D1Row[]) {
            const shifts: unknown = JSON.parse(String(snapshot.shifts_json));
            if (!Array.isArray(shifts)) throw new Error('Invalid snapshot shifts_json');
            const remaining = shifts.filter(shift =>
                !shift || typeof shift !== 'object' || (shift as { staffId?: unknown }).staffId !== id
            );
            if (remaining.length !== shifts.length) {
                statements.push(context.env.DB.prepare(
                    'UPDATE shift_snapshots SET shifts_json = ?, shift_count = ? WHERE id = ?'
                ).bind(JSON.stringify(remaining), remaining.length, String(snapshot.id)));
            }
        }

        const shiftCount = await context.env.DB.prepare(
            'SELECT COUNT(*) AS count FROM shifts WHERE staffId = ?'
        ).bind(id).first<{ count: number }>();

        // Legacy databases can have non-cascading foreign keys, so remove dependents explicitly.
        statements.push(
            context.env.DB.prepare('DELETE FROM shifts WHERE staffId = ?').bind(id),
            context.env.DB.prepare('DELETE FROM staff_classes WHERE staffId = ?').bind(id),
            context.env.DB.prepare('DELETE FROM staff_available_days WHERE staffId = ?').bind(id),
            context.env.DB.prepare('DELETE FROM shift_preference_dates WHERE staffId = ?').bind(id),
            context.env.DB.prepare('DELETE FROM shift_preferences WHERE staffId = ?').bind(id),
            context.env.DB.prepare('DELETE FROM staffs WHERE id = ? AND retired_at IS NOT NULL').bind(id),
        );
        await context.env.DB.batch(statements);

        return Response.json({ success: true, deletedShifts: shiftCount?.count ?? 0 });
    } catch (error) {
        return handleServerError(error, 'Database error permanently deleting retired staff');
    }
};
