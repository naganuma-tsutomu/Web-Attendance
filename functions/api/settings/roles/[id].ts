import { handleServerError, createValidationError, validateName, validateTargetHours } from '../../../utils/validation';
import type { D1BindParam, Env } from '../../../types';
import { RoleUpdateSchema } from '../../../../shared/settingsEntitySchemas';

// DELETE /api/settings/roles/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;

        const { count } = await context.env.DB.prepare(
            'SELECT COUNT(*) as count FROM staffs WHERE role = ?'
        ).bind(id).first() as { count: number };

        if (count > 0) {
            return createValidationError(`このスタッフ区分は${count}名のスタッフに使用されているため削除できません`);
        }

        const result = await context.env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(id).run();
        if (!result.meta.changes) {
            return Response.json({ error: 'スタッフ区分が見つかりません' }, { status: 404 });
        }
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting role');
    }
};

// PUT /api/settings/roles/:id
// body: { name?: string, targetHours?: number, patternIds?: string[] }
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = RoleUpdateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('スタッフ区分の入力内容が不正です');
        const body = parsed.data;

        const existing = await context.env.DB.prepare('SELECT id FROM roles WHERE id = ?').bind(id).first();
        if (!existing) {
            return Response.json({ error: 'スタッフ区分が見つかりません' }, { status: 404 });
        }

        // Validate name if provided
        if (body.name !== undefined) {
            const nameError = validateName(body.name, 'スタッフ区分名', 50);
            if (nameError) return createValidationError(nameError);
        }
        
        // Validate targetHours if provided
        if (body.targetHours !== undefined) {
            const hoursError = validateTargetHours(body.targetHours);
            if (hoursError) return createValidationError(hoursError);
        }

        const statements = [];

        // スタッフ区分情報の更新
        if (body.name !== undefined || body.targetHours !== undefined || body.weeklyHoursTarget !== undefined) {
            const updates: string[] = [];
            const values: D1BindParam[] = [];
            if (body.name !== undefined) {
                updates.push('name = ?');
                values.push(body.name.trim());
            }
            if (body.targetHours !== undefined) {
                updates.push('targetHours = ?');
                values.push(body.targetHours);
            }
            if (body.weeklyHoursTarget !== undefined) {
                updates.push('weeklyHoursTarget = ?');
                values.push(body.weeklyHoursTarget);
            }

            values.push(id);
            statements.push(
                context.env.DB.prepare(
                    `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`
                ).bind(...values)
            );
        }

        // パターン紐付けの更新 (送られてきた場合のみ)
        if (body.patternIds !== undefined) {
            // 既存の紐付けを全削除してから再挿入
            statements.push(
                context.env.DB.prepare('DELETE FROM role_patterns WHERE roleId = ?').bind(id)
            );

            for (const patternId of body.patternIds) {
                statements.push(
                    context.env.DB.prepare(
                        'INSERT INTO role_patterns (roleId, patternId) VALUES (?, ?)'
                    ).bind(id, patternId)
                );
            }
        }

        await context.env.DB.batch(statements);

        return Response.json({ success: true });
    } catch (e) { 
        return handleServerError(e, 'Database error updating role'); 
    }
};
