import type { ShiftPreference } from '../../../src/types';
import { createValidationError, handleServerError, validateYearMonth, safeJsonParse } from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

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
            const staffDetails = normalizedDates
                .filter((d: any) => d.staffId === staffId)
                .map((d: any) => ({
                    date: d.date,
                    startTime: d.startTime || null,
                    endTime: d.endTime || null,
                    type: d.type || null
                }));

            // unavailableDates should only contain full-day unavailabilities (startTime and endTime are null)
            const staffDates = staffDetails
                .filter(d => !d.startTime && !d.endTime)
                .map(d => d.date);

            return {
                id: legacyRow?.id || `pref_${staffId}_${yearMonth}`,
                staffId,
                yearMonth,
                unavailableDates: staffDetails.length > 0 ? staffDates : safeJsonParse<string[]>(legacyRow?.unavailableDates, []),
                details: staffDetails.length > 0 ? staffDetails : safeJsonParse<string[]>(legacyRow?.unavailableDates, []).map((d: string) => ({ date: d, startTime: null, endTime: null, type: null }))
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

        // Ensure backward compatibility if only unavailableDates is sent
        const details = pref.details || (pref.unavailableDates || []).map(date => ({ date, startTime: null, endTime: null, type: null }));
        const unavailableDates = details.filter(d => !d.startTime && !d.endTime && !d.type).map(d => d.date);

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
                ).bind(JSON.stringify(unavailableDates), existing.id)
            );
        } else {
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preferences (id, staffId, yearMonth, unavailableDates) VALUES (?, ?, ?, ?)"
                ).bind(`pref_${Date.now()}`, pref.staffId, pref.yearMonth, JSON.stringify(unavailableDates))
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
