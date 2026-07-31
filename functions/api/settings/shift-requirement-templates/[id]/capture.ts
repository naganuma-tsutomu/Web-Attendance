import { createValidationError, handleServerError } from '../../../../utils/validation';
import type { Env } from '../../../../types';

interface RequirementRow {
    classId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    minStaffCount: number;
    maxStaffCount: number | null;
    priority: number | null;
}

// POST /api/settings/shift-requirement-templates/:id/capture
// 選択したテンプレートを、現在有効な全クラス設定で上書きする。
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const template = await context.env.DB.prepare(
            'SELECT id FROM shift_requirement_templates WHERE id = ?'
        ).bind(id).first();
        if (!template) {
            return Response.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
        }

        const { results: requirements } = await context.env.DB.prepare(
            `SELECT classId, dayOfWeek, startTime, endTime, minStaffCount, maxStaffCount, priority
             FROM shift_requirements
             ORDER BY classId ASC, dayOfWeek ASC, startTime ASC`
        ).all<RequirementRow>();
        if (requirements.length === 0) {
            return createValidationError('保存できる必要人数設定がありません');
        }

        const statements = [
            context.env.DB.prepare(
                'DELETE FROM shift_requirement_template_items WHERE templateId = ?'
            ).bind(id),
            ...requirements.map((req, index) =>
                context.env.DB.prepare(
                    `INSERT INTO shift_requirement_template_items
                     (id, templateId, classId, dayOfWeek, startTime, endTime,
                      minStaffCount, maxStaffCount, priority, display_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    `srti_${crypto.randomUUID()}`,
                    id,
                    req.classId,
                    req.dayOfWeek,
                    req.startTime,
                    req.endTime,
                    req.minStaffCount,
                    req.maxStaffCount ?? null,
                    req.priority ?? 0,
                    index
                )
            ),
            context.env.DB.prepare(
                `UPDATE shift_requirement_templates SET updated_at = datetime('now') WHERE id = ?`
            ).bind(id),
        ];

        await context.env.DB.batch(statements);
        return Response.json({ success: true, count: requirements.length });
    } catch (e) {
        return handleServerError(e, 'Database error capturing shift requirement template');
    }
};
