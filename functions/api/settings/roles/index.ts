export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM role_settings"
        ).all();
        return Response.json(results);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
