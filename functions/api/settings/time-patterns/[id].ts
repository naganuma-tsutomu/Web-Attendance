import { handleServerError, createValidationError, validateTimeRange, validateName } from '../../../utils/validation';
import type { D1BindParam, Env } from '../../../types';
import { TimePatternUpdateSchema } from '../../../../shared/settingsEntitySchemas';
import { loadRotationSettings } from '../../../utils/rotationSettings';

type DayFlag = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'holiday';
// PUT /api/settings/time-patterns/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = TimePatternUpdateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('勤務時間パターンの入力内容が不正です');
        const body = parsed.data;

        const current = await context.env.DB.prepare(
            'SELECT id, startTime, endTime FROM shift_time_patterns WHERE id = ?'
        ).bind(id).first() as { id: string; startTime: string; endTime: string } | null;
        if (!current) {
            return Response.json({ error: '勤務時間パターンが見つかりません' }, { status: 404 });
        }

        // Validate name if provided
        if (body.name !== undefined) {
            const nameError = validateName(body.name, '名前', 50);
            if (nameError) return createValidationError(nameError);
        }

        if (body.startTime !== undefined || body.endTime !== undefined) {
            const timeError = validateTimeRange(
                body.startTime ?? current.startTime,
                body.endTime ?? current.endTime,
            );
            if (timeError) return createValidationError(timeError);
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: D1BindParam[] = [];

        if (body.name !== undefined) {
            updates.push('name = ?');
            values.push(body.name.trim());
        }
        if (body.startTime !== undefined) {
            updates.push('startTime = ?');
            values.push(body.startTime);
        }
        if (body.endTime !== undefined) {
            updates.push('endTime = ?');
            values.push(body.endTime);
        }
        // 曜日・祝日フラグの追加
        const dayFlags: DayFlag[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'holiday'];
        for (const flag of dayFlags) {
            if (body[flag] !== undefined) {
                updates.push(`${flag} = ?`);
                values.push(body[flag]!);
            }
        }

        const statements = [];
        if (updates.length > 0) {
            values.push(id);
            statements.push(
                context.env.DB.prepare(
                    `UPDATE shift_time_patterns SET ${updates.join(', ')} WHERE id = ?`
                ).bind(...values)
            );
        }

        // スタッフ区分の紐付け同期
        if (body.roleIds !== undefined) {
            const roleIds = body.roleIds;
            // 一旦削除
            statements.push(
                context.env.DB.prepare('DELETE FROM role_patterns WHERE patternId = ?').bind(id)
            );
            // 再挿入
            if (roleIds.length > 0) {
                statements.push(...roleIds.map(roleId =>
                    context.env.DB.prepare('INSERT INTO role_patterns (roleId, patternId) VALUES (?, ?)')
                        .bind(roleId, id)
                ));
            }
        }

        await context.env.DB.batch(statements);

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating time pattern');
    }
};

// DELETE /api/settings/time-patterns/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const rotationSettings = await loadRotationSettings(context.env.DB);
        if (
            rotationSettings.earlyPatternId === id ||
            rotationSettings.latePatternId === id ||
            rotationSettings.saturdayPatternId === id
        ) {
            return Response.json(
                { error: 'ローテーション設定で使用中の勤務時間パターンは削除できません' },
                { status: 409 },
            );
        }

        const result = await context.env.DB.prepare(
            'DELETE FROM shift_time_patterns WHERE id = ?'
        ).bind(id).run();
        if (!result.meta.changes) {
            return Response.json({ error: '勤務時間パターンが見つかりません' }, { status: 404 });
        }
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting time pattern');
    }
};
