import { handleServerError, createValidationError, validateName, validateTargetHours } from '../../../utils/validation';
import type { D1BindParam, Env } from '../../../types';
import { RoleUpdateSchema } from '../../../../shared/settingsEntitySchemas';
import { loadRotationSettings } from '../../../utils/rotationSettings';

// DELETE /api/settings/roles/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;

        const role = await context.env.DB.prepare(
            'SELECT id, name FROM roles WHERE id = ?'
        ).bind(id).first<{ id: string; name: string }>();
        if (!role) {
            return Response.json({ error: 'スタッフ区分が見つかりません' }, { status: 404 });
        }

        const { count } = await context.env.DB.prepare(
            'SELECT COUNT(*) as count FROM staffs WHERE role = ? OR role = ?'
        ).bind(id, role.name).first() as { count: number };

        if (count > 0) {
            return createValidationError(`このスタッフ区分は${count}名のスタッフに使用されているため削除できません`);
        }

        const rotationSettings = await loadRotationSettings(context.env.DB);
        if (rotationSettings.roleId === id) {
            return Response.json(
                { error: 'ローテーション設定で使用中のスタッフ区分は削除できません' },
                { status: 409 },
            );
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

        const existing = await context.env.DB.prepare(
            'SELECT id, name FROM roles WHERE id = ?'
        ).bind(id).first<{ id: string; name: string }>();
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

            // staffs.role は既存データとの互換性のため名称を保持している場合がある。
            // 区分名の変更時は同じbatch内で所属スタッフも追従させる。
            if (body.name !== undefined && body.name.trim() !== existing.name) {
                statements.push(
                    context.env.DB.prepare(
                        'UPDATE staffs SET role = ? WHERE role = ?'
                    ).bind(body.name.trim(), existing.name)
                );
            }
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
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed') && e.message.includes('roles.name')) {
            return createValidationError('同じ名前のスタッフ区分が既にあります');
        }
        return handleServerError(e, 'Database error updating role'); 
    }
};
