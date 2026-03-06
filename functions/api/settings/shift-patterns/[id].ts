export interface Env {
    DB: D1Database;
}

// DELETE /api/settings/shift-patterns/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        await context.env.DB.prepare(
            'DELETE FROM shift_patterns WHERE id = ?'
        ).bind(id).run();
        return Response.json({ success: true });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
