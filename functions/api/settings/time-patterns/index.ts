export interface Env { DB: D1Database; }

// GET /api/settings/time-patterns
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            'SELECT * FROM shift_time_patterns ORDER BY startTime'
        ).all();
        return Response.json(results);
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};

// POST /api/settings/time-patterns
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name: string; startTime: string; endTime: string };
        const id = `stp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await context.env.DB.prepare(
            'INSERT INTO shift_time_patterns (id, name, startTime, endTime) VALUES (?, ?, ?, ?)'
        ).bind(id, body.name, body.startTime, body.endTime).run();
        return Response.json({ id });
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};
