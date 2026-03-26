import { handleServerError, createValidationError, validateName, validateTargetHours } from '../../../utils/validation';
import type { Env, D1Row } from '../../../types';

// GET /api/settings/roles — スタッフ区分+紐付けパターン一覧
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results: roles } = await context.env.DB.prepare(
            'SELECT * FROM roles ORDER BY display_order ASC, name ASC'
        ).all();

        // 各スタッフ区分に紐付くパターンも一緒に返す
        const { results: rp } = await context.env.DB.prepare(
            `SELECT rp.roleId, stp.*
             FROM role_patterns rp
             JOIN shift_time_patterns stp ON rp.patternId = stp.id
             ORDER BY stp.display_order ASC`
        ).all();

        // 共通パターン（どのスタッフ区分にも紐付いていないパターン）を取得
        const { results: commonPatterns } = await context.env.DB.prepare(
            `SELECT * FROM shift_time_patterns
             WHERE id NOT IN (SELECT patternId FROM role_patterns)
             ORDER BY display_order ASC`
        ).all();

        const enriched = (roles as D1Row[]).map((role) => {
            const roleSpecificPatterns = (rp as D1Row[]).filter((p) => p.roleId === role.id);
            return {
                ...role,
                patterns: [...roleSpecificPatterns, ...(commonPatterns as D1Row[])]
                    .sort((a, b) => ((a.display_order as number) || 0) - ((b.display_order as number) || 0))
            };
        });

        return Response.json(enriched);
    } catch (e) {
        return handleServerError(e, 'Database error fetching roles');
    }
};

// POST /api/settings/roles — スタッフ区分追加
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name: string, targetHours?: number | null, weeklyHoursTarget?: number | null, patternIds?: string[] };

        // Validate name
        const nameError = validateName(body.name, 'スタッフ区分名', 50);
        if (nameError) return createValidationError(nameError);

        // Validate targetHours if provided
        const hoursError = validateTargetHours(body.targetHours);
        if (hoursError) return createValidationError(hoursError);

        const id = `stp_${crypto.randomUUID()}`;

        // 1. スタッフ区分の追加 (display_order は既存の最大値 + 1)
        const { maxOrder } = await context.env.DB.prepare('SELECT MAX(display_order) as maxOrder FROM roles').first<{ maxOrder: number }>();
        const nextOrder = (maxOrder || 0) + 1;

        await context.env.DB.prepare(
            'INSERT INTO roles (id, name, targetHours, weeklyHoursTarget, display_order) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, body.name.trim(), body.targetHours === undefined ? null : body.targetHours, body.weeklyHoursTarget === undefined ? null : body.weeklyHoursTarget, nextOrder).run();

        // 2. パターンの紐付け (もしあれば)
        if (body.patternIds && body.patternIds.length > 0) {
            const statements = body.patternIds.map(patternId =>
                context.env.DB.prepare('INSERT INTO role_patterns (roleId, patternId) VALUES (?, ?)')
                    .bind(id, patternId)
            );
            await context.env.DB.batch(statements);
        }

        return Response.json({ id });
    } catch (e) {
        return handleServerError(e, 'Database error creating role');
    }
};
