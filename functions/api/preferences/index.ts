import type { ShiftPreference } from '../../../src/types';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        if (!yearMonth) return new Response('Missing yearMonth payload', { status: 400 });

        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shift_preferences WHERE yearMonth = ?"
        ).bind(yearMonth).all();

        const prefs = results.map((row: any) => ({
            ...row,
            unavailableDates: JSON.parse(row.unavailableDates)
        }));

        return Response.json(prefs);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const pref: Omit<ShiftPreference, 'id'> = await context.request.json();

        // Upsert logic for D1 SQLite
        const existing = await context.env.DB.prepare(
            "SELECT id FROM shift_preferences WHERE staffId = ? AND yearMonth = ?"
        ).bind(pref.staffId, pref.yearMonth).first();

        if (existing) {
            await context.env.DB.prepare(
                "UPDATE shift_preferences SET unavailableDates = ? WHERE id = ?"
            ).bind(JSON.stringify(pref.unavailableDates), existing.id).run();
            return Response.json({ id: existing.id });
        } else {
            const newId = `pref_${Date.now()}`;
            await context.env.DB.prepare(
                "INSERT INTO shift_preferences (id, staffId, yearMonth, unavailableDates) VALUES (?, ?, ?, ?)"
            ).bind(newId, pref.staffId, pref.yearMonth, JSON.stringify(pref.unavailableDates)).run();
            return Response.json({ id: newId });
        }
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
