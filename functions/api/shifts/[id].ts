export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const { staffId, startTime, endTime, isError } = await context.request.json() as any;

        await context.env.DB.prepare(
            "UPDATE shifts SET staffId = ?, startTime = ?, endTime = ?, isError = ? WHERE id = ?"
        ).bind(staffId, startTime, endTime, isError ? 1 : 0, id).run();

        return new Response('Updated', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
