import { handleServerError } from '../../../../utils/validation';
import type { Env } from '../../../../types';

interface TemplateItem {
    classId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    minStaffCount: number;
    maxStaffCount: number | null;
    priority: number | null;
    display_order: number;
}

// POST /api/settings/shift-requirement-templates/:id/apply
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const template = await context.env.DB.prepare(
            'SELECT id FROM shift_requirement_templates WHERE id = ?'
        ).bind(id).first();
        if (!template) {
            return Response.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
        }

        const { results: items } = await context.env.DB.prepare(
            `SELECT classId, dayOfWeek, startTime, endTime, minStaffCount,
                    maxStaffCount, priority, display_order
             FROM shift_requirement_template_items
             WHERE templateId = ?
             ORDER BY display_order ASC`
        ).bind(id).all<TemplateItem>();

        if (items.length === 0) {
            return Response.json({ error: 'テンプレートに必要人数設定がありません' }, { status: 400 });
        }

        const statements = [
            context.env.DB.prepare('DELETE FROM shift_requirements'),
            ...items.map(item =>
                context.env.DB.prepare(
                    `INSERT INTO shift_requirements
                     (id, classId, dayOfWeek, startTime, endTime, minStaffCount, maxStaffCount, priority)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    `req_${crypto.randomUUID()}`,
                    item.classId,
                    item.dayOfWeek,
                    item.startTime,
                    item.endTime,
                    item.minStaffCount,
                    item.maxStaffCount ?? null,
                    item.priority ?? 0
                )
            ),
        ];

        await context.env.DB.batch(statements);
        return Response.json({ success: true, count: items.length });
    } catch (e) {
        return handleServerError(e, 'Database error applying shift requirement template');
    }
};
