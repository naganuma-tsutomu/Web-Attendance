export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateTimeRange, validateName } from '../../../utils/validation';

// PUT /api/settings/time-patterns/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as { name?: string; startTime?: string; endTime?: string };

        // Validate name if provided
        if (body.name !== undefined) {
            const nameError = validateName(body.name, '名前', 50);
            if (nameError) return createValidationError(nameError);
        }

        // Validate time range if both provided
        if (body.startTime !== undefined && body.endTime !== undefined) {
            const timeError = validateTimeRange(body.startTime, body.endTime);
            if (timeError) return createValidationError(timeError);
        } else if (body.startTime !== undefined) {
            // Only startTime provided, fetch current endTime to validate
            const current = await context.env.DB.prepare(
                'SELECT endTime FROM shift_time_patterns WHERE id = ?'
            ).bind(id).first() as { endTime: string } | null;
            if (current) {
                const timeError = validateTimeRange(body.startTime, current.endTime);
                if (timeError) return createValidationError(timeError);
            }
        } else if (body.endTime !== undefined) {
            // Only endTime provided, fetch current startTime to validate
            const current = await context.env.DB.prepare(
                'SELECT startTime FROM shift_time_patterns WHERE id = ?'
            ).bind(id).first() as { startTime: string } | null;
            if (current) {
                const timeError = validateTimeRange(current.startTime, body.endTime);
                if (timeError) return createValidationError(timeError);
            }
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];

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
        const dayFlags = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'holiday'];
        for (const flag of dayFlags) {
            if ((body as any)[flag] !== undefined) {
                updates.push(`${flag} = ?`);
                values.push((body as any)[flag]);
            }
        }

        if (updates.length > 0) {
            values.push(id);
            await context.env.DB.prepare(
                `UPDATE shift_time_patterns SET ${updates.join(', ')} WHERE id = ?`
            ).bind(...values).run();
        }

        // 役職の紐付け同期
        if ((body as any).roleIds !== undefined) {
            const roleIds = (body as any).roleIds as string[];
            // 一旦削除
            await context.env.DB.prepare('DELETE FROM role_patterns WHERE patternId = ?').bind(id).run();
            // 再挿入
            if (roleIds.length > 0) {
                const statements = roleIds.map(roleId =>
                    context.env.DB.prepare('INSERT INTO role_patterns (roleId, patternId) VALUES (?, ?)')
                        .bind(roleId, id)
                );
                await context.env.DB.batch(statements);
            }
        }

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating time pattern');
    }
};

// DELETE /api/settings/time-patterns/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare('DELETE FROM shift_time_patterns WHERE id = ?').bind(id).run();
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting time pattern');
    }
};
