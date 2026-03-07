import type { ShiftPreference } from '../../../src/types';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        if (!yearMonth) return new Response('Missing yearMonth payload', { status: 400 });

        // Get legacy records
        const { results: legacyResults } = await context.env.DB.prepare(
            "SELECT * FROM shift_preferences WHERE yearMonth = ?"
        ).bind(yearMonth).all();

        // Get normalized records
        const { results: normalizedDates } = await context.env.DB.prepare(
            "SELECT * FROM shift_preference_dates WHERE yearMonth = ?"
        ).bind(yearMonth).all();

        // Map normalized data
        const staffIds = Array.from(new Set([...legacyResults.map((r: any) => r.staffId), ...normalizedDates.map((r: any) => r.staffId)]));

        const prefs = staffIds.map(staffId => {
            const legacyRow = legacyResults.find((r: any) => r.staffId === staffId);
            const staffDates = normalizedDates
                .filter((d: any) => d.staffId === staffId)
                .map((d: any) => d.date);

            return {
                id: legacyRow?.id || `pref_${staffId}_${yearMonth}`,
                staffId,
                yearMonth,
                // Prefer normalized dates, fallback to legacy
                unavailableDates: staffDates.length > 0 ? staffDates : (legacyRow ? JSON.parse(legacyRow.unavailableDates) : [])
            };
        });

        return Response.json(prefs);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const pref: Omit<ShiftPreference, 'id'> = await context.request.json();

        // Statements for batch execution
        const statements = [];

        // 1. Legacy Upsert
        const existing = await context.env.DB.prepare(
            "SELECT id FROM shift_preferences WHERE staffId = ? AND yearMonth = ?"
        ).bind(pref.staffId, pref.yearMonth).first();

        if (existing) {
            statements.push(
                context.env.DB.prepare(
                    "UPDATE shift_preferences SET unavailableDates = ? WHERE id = ?"
                ).bind(JSON.stringify(pref.unavailableDates), existing.id)
            );
        } else {
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preferences (id, staffId, yearMonth, unavailableDates) VALUES (?, ?, ?, ?)"
                ).bind(`pref_${Date.now()}`, pref.staffId, pref.yearMonth, JSON.stringify(pref.unavailableDates))
            );
        }

        // 2. Normalized Reset (Delete and Re-insert)
        statements.push(
            context.env.DB.prepare(
                "DELETE FROM shift_preference_dates WHERE staffId = ? AND yearMonth = ?"
            ).bind(pref.staffId, pref.yearMonth)
        );

        pref.unavailableDates.forEach((date, idx) => {
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preference_dates (id, staffId, yearMonth, date) VALUES (?, ?, ?, ?)"
                ).bind(`prefd_${pref.staffId}_${date}_${idx}`, pref.staffId, pref.yearMonth, date)
            );
        });

        await context.env.DB.batch(statements);
        return Response.json({ success: true });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
