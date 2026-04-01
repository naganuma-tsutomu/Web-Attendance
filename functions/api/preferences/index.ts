import type { ShiftPreference } from '../../../src/types';
import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';
import type { Env, D1Row } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        // Get legacy records (table kept for grouping but unavailableDates removed)
        const { results: legacyResults } = await context.env.DB.prepare(
            "SELECT id, staffId, yearMonth, submitted FROM shift_preferences WHERE yearMonth = ?"
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
                submitted: legacyRow?.submitted === 1,
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
        const hasSubmittedFlag = typeof (pref as any).submitted === 'boolean';
        const submittedValue = (pref as any).submitted === true ? 1 : 0;

        // Statements for batch execution
        const statements = [];

        // 1. Legacy Upsert (without unavailableDates)
        const existing = await context.env.DB.prepare(
            "SELECT id, submitted FROM shift_preferences WHERE staffId = ? AND yearMonth = ?"
        ).bind(pref.staffId, pref.yearMonth).first();

        if (!existing) {
            // 新規レコード: submitted は明示的に指定された値か 0
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preferences (id, staffId, yearMonth, submitted) VALUES (?, ?, ?, ?)"
                ).bind(`pref_${Date.now()}`, pref.staffId, pref.yearMonth, hasSubmittedFlag ? submittedValue : 0)
            );
        } else if (hasSubmittedFlag) {
            // 既存レコード: submitted が明示的に指定された場合のみ更新
            statements.push(
                context.env.DB.prepare(
                    "UPDATE shift_preferences SET submitted = ? WHERE staffId = ? AND yearMonth = ?"
                ).bind(submittedValue, pref.staffId, pref.yearMonth)
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

// PATCH: submitted フラグのみ更新（管理者が提出済み状態を手動で変更する用途）
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    try {
        const body: { staffId: string; yearMonth: string; submitted: boolean } = await context.request.json();
        const ymError = validateYearMonth(body?.yearMonth);
        if (ymError) return createValidationError(ymError);

        if (!body.staffId) return createValidationError('staffId は必須です');
        if (typeof body.submitted !== 'boolean') return createValidationError('submitted は boolean 型で指定してください');

        const submittedValue = body.submitted ? 1 : 0;

        const existing = await context.env.DB.prepare(
            "SELECT id FROM shift_preferences WHERE staffId = ? AND yearMonth = ?"
        ).bind(body.staffId, body.yearMonth).first();

        if (!existing) {
            // レコードがない場合は作成
            await context.env.DB.prepare(
                "INSERT INTO shift_preferences (id, staffId, yearMonth, submitted) VALUES (?, ?, ?, ?)"
            ).bind(`pref_${Date.now()}`, body.staffId, body.yearMonth, submittedValue).run();
        } else {
            await context.env.DB.prepare(
                "UPDATE shift_preferences SET submitted = ? WHERE staffId = ? AND yearMonth = ?"
            ).bind(submittedValue, body.staffId, body.yearMonth).run();
        }

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'PATCH /preferences');
    }
};
