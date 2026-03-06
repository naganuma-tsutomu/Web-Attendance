export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const role = context.params.role as string;
        const { defaultStartTime, defaultEndTime } = await context.request.json() as any;

        if (!defaultStartTime || !defaultEndTime) {
            return new Response('Missing required fields', { status: 400 });
        }

        await context.env.DB.prepare(
            "UPDATE role_settings SET defaultStartTime = ?, defaultEndTime = ? WHERE role = ?"
        ).bind(defaultStartTime, defaultEndTime, decodeURIComponent(role)).run();

        return new Response('Updated', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
