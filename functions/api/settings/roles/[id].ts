export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateName, validateTargetHours } from '../../utils/validation';

// DELETE /api/settings/roles/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(id).run();
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
        const body = await context.request.json() as { name?: string, targetHours?: number, patternIds?: string[] };

        // Validate name if provided
        if (body.name !== undefined) {
            const nameError = validateName(body.name, '役職名', 50);
            if (nameError) return createValidationError(nameError);
        }
        
        // Validate targetHours if provided
        if (body.targetHours !== undefined) {
            const hoursError = validateTargetHours(body.targetHours);
            if (hoursError) return createValidationError(hoursError);
        }

        // 役職情報の更新
        if (body.name !== undefined || body.targetHours !== undefined) {
            const updates: string[] = [];
            const values: any[] = [];
            if (body.name !== undefined) {
                updates.push('name = ?');
                values.push(body.name.trim());
            }
            if (body.targetHours !== undefined) {
                updates.push('targetHours = ?');
                values.push(body.targetHours);
            }
            values.push(id);
            await context.env.DB.prepare(
                `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`
            ).bind(...values).run();
        }

        // パターン紐付けの更新 (送られてきた場合のみ)
        if (body.patternIds) {
            // 既存の紐付けを全削除してから再挿入
            await context.env.DB.prepare('DELETE FROM role_patterns WHERE roleId = ?').bind(id).run();

            for (const patternId of body.patternIds) {
                await context.env.DB.prepare(
                    'INSERT OR IGNORE INTO role_patterns (roleId, patternId) VALUES (?, ?)'
                ).bind(id, patternId).run();
            }
        }

        return Response.json({ success: true });
    } catch (e) { 
        return handleServerError(e, 'Database error updating role'); 
    }
};
