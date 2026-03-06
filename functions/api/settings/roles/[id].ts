export interface Env { DB: D1Database; }

// DELETE /api/settings/roles/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(id).run();
        return Response.json({ success: true });
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};

// PUT /api/settings/roles/:id/patterns  — パターン紐付けの一括更新
// body: { patternIds: string[] }
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as { patternIds: string[] };

        // 既存の紐付けを全削除してから再挿入
        await context.env.DB.prepare('DELETE FROM role_patterns WHERE roleId = ?').bind(id).run();

        for (const patternId of body.patternIds) {
            await context.env.DB.prepare(
                'INSERT OR IGNORE INTO role_patterns (roleId, patternId) VALUES (?, ?)'
            ).bind(id, patternId).run();
        }

        return Response.json({ success: true });
    } catch (e) { return new Response((e as Error).message, { status: 500 }); }
};
