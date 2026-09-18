import { createValidationError, handleServerError, validateName } from '../../../utils/validation';
import type { Env } from '../../../types';
import { RequirementTemplateNameSchema } from '../../../../shared/basicRequestSchemas';

// PUT /api/settings/shift-requirement-templates/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const parsed = RequirementTemplateNameSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('テンプレート名を正しく入力してください');
        const body = parsed.data;
        const nameError = validateName(body.name ?? '', 'テンプレート名', 50);
        if (nameError) return createValidationError(nameError);

        const name = body.name;
        const duplicate = await context.env.DB.prepare(
            'SELECT id FROM shift_requirement_templates WHERE name = ? AND id <> ?'
        ).bind(name, id).first();
        if (duplicate) return createValidationError('同じ名前のテンプレートが既にあります');

        const result = await context.env.DB.prepare(
            `UPDATE shift_requirement_templates
             SET name = ?, updated_at = datetime('now')
             WHERE id = ?`
        ).bind(name, id).run();
        if (!result.meta.changes) {
            return Response.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating shift requirement template');
    }
};

// DELETE /api/settings/shift-requirement-templates/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const result = await context.env.DB.prepare(
            'DELETE FROM shift_requirement_templates WHERE id = ?'
        ).bind(id).run();
        if (!result.meta.changes) {
            return Response.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
        }
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shift requirement template');
    }
};
