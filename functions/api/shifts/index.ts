export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        if (!yearMonth) return new Response('Missing yearMonth payload', { status: 400 });

        const startStr = `${yearMonth}-01`;
        const endStr = `${yearMonth}-31`;

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE date >= ? AND date <= ?"
        ).bind(startStr, endStr).all();

        const shifts = results.map((row: any) => ({
            ...row,
            isEarlyShift: row.isEarlyShift === 1,
            isError: row.isError === 1
        }));

        return Response.json(shifts);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const shiftsData: any[] = await context.request.json();
        if (!shiftsData || shiftsData.length === 0) {
            return Response.json({ success: true, message: 'No data to insert' });
        }

        const stmt = context.env.DB.prepare(
            `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        // D1 batch limit is 100 statements. Split data into chunks of 100.
        const chunkSize = 100;
        for (let i = 0; i < shiftsData.length; i += chunkSize) {
            const chunk = shiftsData.slice(i, i + chunkSize);
            const batch = chunk.map((shift) => stmt.bind(
                `shift_${crypto.randomUUID()}`,
                shift.date,
                shift.staffId,
                shift.startTime,
                shift.endTime,
                shift.classType,
                shift.isEarlyShift ? 1 : 0,
                shift.isError ? 1 : 0
            ));
            await context.env.DB.batch(batch);
        }

        return Response.json({ success: true, message: `Successfully inserted ${shiftsData.length} shifts` });
    } catch (e) {
        console.error('Batch insert error:', e);
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        if (!yearMonth) return new Response('Missing yearMonth', { status: 400 });

        await context.env.DB.prepare(
            "DELETE FROM shifts WHERE date LIKE ?"
        ).bind(`${yearMonth}%`).run();

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
