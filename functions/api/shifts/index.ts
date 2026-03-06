import type { Shift } from '../../../src/types';

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
        const shiftsData: Omit<Shift, 'id'>[] = await context.request.json();

        // In a real production scenario, doing 100+ inserts in loop might be slow if not batched.
        // D1 supports batching
        const stmt = context.env.DB.prepare(
            `INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, isEarlyShift, isError)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const batch = shiftsData.map((shift, i) => stmt.bind(
            `shift_${Date.now()}_${i}`,
            shift.date,
            shift.staffId,
            shift.startTime,
            shift.endTime,
            shift.classType,
            shift.isEarlyShift ? 1 : 0,
            shift.isError ? 1 : 0
        ));

        await context.env.DB.batch(batch);

        return new Response('Batch inserted', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
