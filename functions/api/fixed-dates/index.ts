export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        if (!yearMonth) return new Response('Missing yearMonth payload', { status: 400 });

        const { results } = await context.env.DB.prepare(
            "SELECT date FROM fixed_dates WHERE yearMonth = ?"
        ).bind(yearMonth).all<{date: string}>();

        const dates = results.map(row => row.date);

        return Response.json(dates);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body: { yearMonth: string, dates: string[] } = await context.request.json();
        const { yearMonth, dates } = body;
        
        if (!yearMonth) {
            return new Response('Missing yearMonth payload', { status: 400 });
        }

        // Delete all fixed dates for the given month
        await context.env.DB.prepare(
            "DELETE FROM fixed_dates WHERE yearMonth = ?"
        ).bind(yearMonth).run();

        // Insert new fixed dates if any
        if (dates && dates.length > 0) {
            const stmt = context.env.DB.prepare(
                `INSERT INTO fixed_dates (date, yearMonth) VALUES (?, ?)`
            );
            
            const batch = dates.map(date => stmt.bind(date, yearMonth));
            await context.env.DB.batch(batch);
        }

        return Response.json({ success: true, message: `Successfully updated fixed dates` });
    } catch (e) {
        console.error('Batch insert error:', e);
        return new Response((e as Error).message, { status: 500 });
    }
};
