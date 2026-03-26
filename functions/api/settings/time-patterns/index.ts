import { handleServerError, createValidationError, validateTimeRange, validateName } from '../../../utils/validation';
import type { Env, D1Row } from '../../../types';

// GET /api/settings/time-patterns
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results: patterns } = await context.env.DB.prepare(
            'SELECT * FROM shift_time_patterns ORDER BY display_order ASC, startTime ASC'
        ).all();

        // 各パターンに紐付くスタッフ区分IDも一緒に返す
        const { results: rp } = await context.env.DB.prepare(
            'SELECT patternId, roleId FROM role_patterns'
        ).all();

        const enriched = (patterns as D1Row[]).map((p) => ({
            ...p,
            roleIds: (rp as D1Row[]).filter((item) => item.patternId === p.id).map((item) => item.roleId as string)
        }));

        return Response.json(enriched);
    } catch (e) {
        return handleServerError(e, 'Database error fetching time patterns');
    }
};

// POST /api/settings/time-patterns
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as {
            name: string;
            startTime: string;
            endTime: string;
            roleIds?: string[];
            sun?: number;
            mon?: number;
            tue?: number;
            wed?: number;
            thu?: number;
            fri?: number;
            sat?: number;
            holiday?: number;
        };

        // Validate name
        const nameError = validateName(body.name, '名前', 50);
        if (nameError) return createValidationError(nameError);

        // Validate time range
        const timeError = validateTimeRange(body.startTime, body.endTime);
        if (timeError) return createValidationError(timeError);

        const id = `stp_${crypto.randomUUID()}`;

        // Get max display_order
        const { maxOrder } = await context.env.DB.prepare('SELECT MAX(display_order) as maxOrder FROM shift_time_patterns').first<{ maxOrder: number }>();
        const nextOrder = (maxOrder || 0) + 1;

        await context.env.DB.prepare(
            `INSERT INTO shift_time_patterns (
                id, name, startTime, endTime, display_order,
                sun, mon, tue, wed, thu, fri, sat, holiday
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id, body.name.trim(), body.startTime, body.endTime, nextOrder,
            body.sun ?? 1, body.mon ?? 1, body.tue ?? 1, body.wed ?? 1, body.thu ?? 1, body.fri ?? 1, body.sat ?? 1, body.holiday ?? 1
        ).run();

        // スタッフ区分の紐付け
        if (body.roleIds && body.roleIds.length > 0) {
            const statements = body.roleIds.map(roleId =>
                context.env.DB.prepare('INSERT INTO role_patterns (roleId, patternId) VALUES (?, ?)')
                    .bind(roleId, id)
            );
            await context.env.DB.batch(statements);
        }

        return Response.json({ id });
    } catch (e) {
        return handleServerError(e, 'Database error creating time pattern');
    }
};
