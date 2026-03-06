export interface Env {
    DB: D1Database;
}

// GET /api/settings/shift-patterns?role=xxx
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const role = url.searchParams.get('role');
        let query = 'SELECT * FROM shift_patterns';
        const params: string[] = [];
        if (role) {
            query += ' WHERE role = ?';
            params.push(role);
        }
        query += ' ORDER BY role, startTime';
        const { results } = await context.env.DB.prepare(query).bind(...params).all();
        return Response.json(results);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

// POST /api/settings/shift-patterns
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as {
            role: string;
            name: string;
            startTime: string;
            endTime: string;
        };
        const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await context.env.DB.prepare(
            'INSERT INTO shift_patterns (id, role, name, startTime, endTime) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, body.role, body.name, body.startTime, body.endTime).run();
        return Response.json({ id });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
