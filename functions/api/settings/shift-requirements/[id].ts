import {
    ShiftRequirementRequestSchema,
    ShiftRequirementUpdateSchema,
} from '../../../../shared/shiftRequirementSchema';
import { handleServerError, createValidationError } from '../../../utils/validation';

import type { D1BindParam, Env } from '../../../types';

// PUT /api/settings/shift-requirements/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = ShiftRequirementUpdateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('必要人数設定の入力内容が不正です');
        const body = parsed.data;

        const current = await context.env.DB.prepare(
            `SELECT id, classId, dayOfWeek, startTime, endTime,
                    minStaffCount, maxStaffCount, priority
             FROM shift_requirements WHERE id = ?`
        ).bind(id).first();
        if (!current) {
            return Response.json({ error: '必要人数設定が見つかりません' }, { status: 404 });
        }

        // 部分更新後の全体を再検証し、既存値との組み合わせによる不整合を防ぐ。
        const merged = ShiftRequirementRequestSchema.safeParse({ ...current, ...body, id });
        if (!merged.success) return createValidationError('更新後の必要人数設定が不正です');

        // Build update query dynamically
        const updates: string[] = [];
        const values: D1BindParam[] = [];

        if (body.classId !== undefined) {
            updates.push('classId = ?');
            values.push(merged.data.classId);
        }

        if (body.dayOfWeek !== undefined) {
            updates.push('dayOfWeek = ?');
            values.push(merged.data.dayOfWeek);
        }

        if (body.startTime !== undefined) {
            updates.push('startTime = ?');
            values.push(merged.data.startTime);
        }

        if (body.endTime !== undefined) {
            updates.push('endTime = ?');
            values.push(merged.data.endTime);
        }

        if (body.minStaffCount !== undefined) {
            updates.push('minStaffCount = ?');
            values.push(merged.data.minStaffCount);
        }

        if (body.maxStaffCount !== undefined) {
            updates.push('maxStaffCount = ?');
            values.push(merged.data.maxStaffCount ?? null);
        }

        if (body.priority !== undefined) {
            updates.push('priority = ?');
            values.push(merged.data.priority ?? 0);
        }

        values.push(id);
        await context.env.DB.prepare(
            `UPDATE shift_requirements SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run();
        
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating shift requirement');
    }
};

// DELETE /api/settings/shift-requirements/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;

        const result = await context.env.DB.prepare(
            'DELETE FROM shift_requirements WHERE id = ?'
        ).bind(id).run();
        if (!result.meta.changes) {
            return Response.json({ error: '必要人数設定が見つかりません' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shift requirement');
    }
};
