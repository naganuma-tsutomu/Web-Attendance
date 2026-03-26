import type { ShiftPreference } from '../../../src/types';
import { createValidationError, handleServerError, validateYearMonth, safeJsonParse } from '../../utils/validation';
import type { Env, D1Row } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        // Get legacy records (table kept for grouping but unavailableDates removed)
        const { results: legacyResults } = await context.env.DB.prepare(
            "SELECT id, staffId, yearMonth FROM shift_preferences WHERE yearMonth = ?"
        ).bind(yearMonth).all();

        // Get normalized records
        const { results: normalizedDates } = await context.env.DB.prepare(
            "SELECT * FROM shift_preference_dates WHERE yearMonth = ?"
        ).bind(yearMonth).all();

        // Map normalized data
        const staffIds = Array.from(new Set([
            ...(legacyResults as D1Row[]).map((r) => r.staffId as string),
            ...(normalizedDates as D1Row[]).map((r) => r.staffId as string)
        ]));

        const prefs = staffIds.map(staffId => {
            const legacyRow = (legacyResults as D1Row[]).find((r) => r.staffId === staffId);
            const staffDetails = (normalizedDates as D1Row[])
                .filter((d) => d.staffId === staffId)
                .map((d) => ({
                    date: d.date as string,
                    startTime: (d.startTime as string) || null,
                    endTime: (d.endTime as string) || null,
                    type: (d.type as string) || null
                }));

            return {
                id: legacyRow?.id || `pref_${staffId}_${yearMonth}`,
                staffId,
                yearMonth,
                details: staffDetails
            };
        });

        return Response.json(prefs);
    } catch (e) {
        return handleServerError(e, 'GET /preferences');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const pref: Omit<ShiftPreference, 'id'> = await context.request.json();
        const ymError = validateYearMonth(pref?.yearMonth);
        if (ymError) return createValidationError(ymError);

        const details = pref.details || [];

        // Statements for batch execution
        const statements = [];

        // 1. Legacy Upsert (without unavailableDates)
        const existing = await context.env.DB.prepare(
            "SELECT id FROM shift_preferences WHERE staffId = ? AND yearMonth = ?"
        ).bind(pref.staffId, pref.yearMonth).first();

        if (!existing) {
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preferences (id, staffId, yearMonth) VALUES (?, ?, ?)"
                ).bind(`pref_${Date.now()}`, pref.staffId, pref.yearMonth)
            );
        }

        // 2. Normalized Reset (Delete and Re-insert)
        statements.push(
            context.env.DB.prepare(
                "DELETE FROM shift_preference_dates WHERE staffId = ? AND yearMonth = ?"
            ).bind(pref.staffId, pref.yearMonth)
        );

        details.forEach((d, idx) => {
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preference_dates (id, staffId, yearMonth, date, startTime, endTime, type) VALUES (?, ?, ?, ?, ?, ?, ?)"
                ).bind(`prefd_${pref.staffId}_${d.date}_${idx}`, pref.staffId, pref.yearMonth, d.date, d.startTime, d.endTime, d.type || null)
            );
        });

        await context.env.DB.batch(statements);
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'POST /preferences');
    }
};
