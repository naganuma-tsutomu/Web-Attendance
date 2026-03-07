export interface Env { DB: D1Database; }

// PUT /api/settings/classes/[id] — クラス更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as { name?: string, display_order?: number, auto_allocate?: number };

        let query = 'UPDATE classes SET ';
        const sets: string[] = [];
        const params: any[] = [];

        if (body.name !== undefined) {
            sets.push('name = ?');
            params.push(body.name);
        }
        if (body.display_order !== undefined) {
            sets.push('display_order = ?');
            params.push(body.display_order);
        }
        if (body.auto_allocate !== undefined) {
            sets.push('auto_allocate = ?');
            params.push(body.auto_allocate);
        }

        if (sets.length === 0) return new Response('No data to update', { status: 400 });

        query += sets.join(', ') + ' WHERE id = ?';
        params.push(id);

        await context.env.DB.prepare(query).bind(...params).run();
        return new Response(null, { status: 204 });
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};

// DELETE /api/settings/classes/[id] — クラス削除
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id).run();
        return new Response(null, { status: 204 });
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};
