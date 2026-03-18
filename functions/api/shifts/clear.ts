export interface Env {
    DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body: { yearMonth: string, exceptDates?: string[] } = await context.request.json();
        const { yearMonth, exceptDates } = body;
        
        if (!yearMonth) return new Response('Missing yearMonth', { status: 400 });

        if (exceptDates && exceptDates.length > 0) {
            const placeholders = exceptDates.map(() => '?').join(',');
            await context.env.DB.prepare(
                `DELETE FROM shifts WHERE date LIKE ? AND date NOT IN (${placeholders})`
            ).bind(`${yearMonth}%`, ...exceptDates).run();
        } else {
            await context.env.DB.prepare(
                "DELETE FROM shifts WHERE date LIKE ?"
            ).bind(`${yearMonth}%`).run();
        }

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
