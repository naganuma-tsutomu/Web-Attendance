export interface Env { DB: D1Database; }

// GET /api/settings/classes — クラス一覧
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results: classes } = await context.env.DB.prepare(
            'SELECT * FROM classes ORDER BY display_order, name'
        ).all();
        return Response.json(classes);
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};

// POST /api/settings/classes — クラス追加
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name: string };
        const id = `class_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        await context.env.DB.prepare(
            'INSERT INTO classes (id, name, display_order) VALUES (?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM classes))'
        ).bind(id, body.name).run();

        return Response.json({ id });
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};
