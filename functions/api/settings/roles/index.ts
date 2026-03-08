export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateName, validateTargetHours } from '../../../utils/validation';

// GET /api/settings/roles — 役職+紐付けパターン一覧
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results: roles } = await context.env.DB.prepare(
            'SELECT * FROM roles ORDER BY display_order ASC, name ASC'
        ).all();

        // 各役職に紐付くパターンも一緒に返す
        const { results: rp } = await context.env.DB.prepare(
            `SELECT rp.roleId, stp.id, stp.name, stp.startTime, stp.endTime
             FROM role_patterns rp
             JOIN shift_time_patterns stp ON rp.patternId = stp.id`
        ).all();

        const enriched = roles.map((role) => ({
            ...role,
            patterns: rp.filter((p) => p.roleId === role.id)
        }));

        return Response.json(enriched);
    } catch (e) {
        return handleServerError(e, 'Database error fetching roles');
    }
};

// POST /api/settings/roles — 役職追加
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name: string, targetHours?: number | null, patternIds?: string[] };

        // Validate name
        const nameError = validateName(body.name, '役職名', 50);
        if (nameError) return createValidationError(nameError);

        // Validate targetHours if provided
        const hoursError = validateTargetHours(body.targetHours);
        if (hoursError) return createValidationError(hoursError);

        const id = `role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // 1. 役職の追加 (display_order は既存の最大値 + 1)
        const { maxOrder } = await context.env.DB.prepare('SELECT MAX(display_order) as maxOrder FROM roles').first<{ maxOrder: number }>();
        const nextOrder = (maxOrder || 0) + 1;

        await context.env.DB.prepare(
            'INSERT INTO roles (id, name, targetHours, display_order) VALUES (?, ?, ?, ?)'
        ).bind(id, body.name.trim(), body.targetHours === undefined ? null : body.targetHours, nextOrder).run();

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
