import { createValidationError, handleServerError, validateName } from '../../../utils/validation';
import type { Env } from '../../../types';

interface TemplateRow {
    id: string;
    name: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
}

// GET /api/settings/shift-requirement-templates
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT
                t.id,
                t.name,
                COUNT(i.id) AS itemCount,
                t.created_at AS createdAt,
                t.updated_at AS updatedAt
             FROM shift_requirement_templates t
             LEFT JOIN shift_requirement_template_items i ON i.templateId = t.id
             GROUP BY t.id, t.name, t.created_at, t.updated_at
             ORDER BY t.updated_at DESC, t.name ASC`
        ).all<TemplateRow>();

        return Response.json(results);
    } catch (e) {
        return handleServerError(e, 'Database error fetching shift requirement templates');
    }
};

// POST /api/settings/shift-requirement-templates
// 現在有効な全クラスの必要人数設定をスナップショットとして保存する。
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name?: string };
        const nameError = validateName(body.name ?? '', 'テンプレート名', 50);
        if (nameError) return createValidationError(nameError);

        const name = body.name!.trim();
        const duplicate = await context.env.DB.prepare(
            'SELECT id FROM shift_requirement_templates WHERE name = ?'
        ).bind(name).first();
        if (duplicate) return createValidationError('同じ名前のテンプレートが既にあります');

        const { results: requirements } = await context.env.DB.prepare(
            `SELECT classId, dayOfWeek, startTime, endTime, minStaffCount, maxStaffCount, priority
             FROM shift_requirements
             ORDER BY classId ASC, dayOfWeek ASC, startTime ASC`
        ).all<{
            classId: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            minStaffCount: number;
            maxStaffCount: number | null;
            priority: number | null;
        }>();

        if (requirements.length === 0) {
            return createValidationError('保存できる必要人数設定がありません');
        }

        const templateId = `srt_${crypto.randomUUID()}`;
        const statements = [
            context.env.DB.prepare(
                'INSERT INTO shift_requirement_templates (id, name) VALUES (?, ?)'
            ).bind(templateId, name),
            ...requirements.map((req, index) =>
                context.env.DB.prepare(
                    `INSERT INTO shift_requirement_template_items
                     (id, templateId, classId, dayOfWeek, startTime, endTime,
                      minStaffCount, maxStaffCount, priority, display_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    `srti_${crypto.randomUUID()}`,
                    templateId,
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
        ];

        await context.env.DB.batch(statements);
        return Response.json({ id: templateId }, { status: 201 });
    } catch (e) {
        return handleServerError(e, 'Database error creating shift requirement template');
    }
};
