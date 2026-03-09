export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateName } from '../../../utils/validation';

// GET /api/settings/classes — クラス一覧
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results: classes } = await context.env.DB.prepare(
            'SELECT * FROM classes ORDER BY display_order, name'
        ).all();
        return Response.json(classes);
    } catch (e) {
        return handleServerError(e, 'Database error fetching classes');
    }
};

// POST /api/settings/classes — クラス追加
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name: string, auto_allocate?: number };

        // Validate name
        const nameError = validateName(body.name, 'クラス名', 50);
        if (nameError) return createValidationError(nameError);

        const id = `class_${crypto.randomUUID()}`;
        const autoAllocate = body.auto_allocate !== undefined ? body.auto_allocate : 1;

        await context.env.DB.prepare(
            'INSERT INTO classes (id, name, display_order, auto_allocate) VALUES (?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM classes), ?)'
        ).bind(id, body.name.trim(), autoAllocate).run();

        return Response.json({ id });
    } catch (e) {
        return handleServerError(e, 'Database error creating class');
    }
};
