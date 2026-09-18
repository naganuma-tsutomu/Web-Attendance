import { ShiftPreferenceRequestSchema, ShiftPreferenceSubmissionSchema } from '../../../shared/shiftPreferenceSchema';
import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';
import type { Env, D1Row } from '../../types';
import { getRequestAuthState, type RequestAuthState } from '../../utils';
import { writeAuditLog } from '../../utils/auditLog';

function buildStaffFilter(authState: RequestAuthState): { where: string; extra: string[] } {
    if (authState.kind === 'staff') {
        return { where: 'AND staffId = ?', extra: [authState.staffId] };
    }
    return { where: '', extra: [] };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);
        const authState = await getRequestAuthState(context.request, context.env.ADMIN_PASSWORD!);

        const staffFilter = buildStaffFilter(authState);

        // Get legacy records (table kept for grouping but unavailableDates removed)
        const { results: legacyResults } = await context.env.DB.prepare(
            `SELECT id, staffId, yearMonth, submitted FROM shift_preferences WHERE yearMonth = ? ${staffFilter.where}`
        ).bind(yearMonth!, ...staffFilter.extra).all();

        // Get normalized records
        const { results: normalizedDates } = await context.env.DB.prepare(
            `SELECT * FROM shift_preference_dates WHERE yearMonth = ? ${staffFilter.where}`
        ).bind(yearMonth!, ...staffFilter.extra).all();

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
        const parsed = ShiftPreferenceRequestSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('希望休の入力内容が不正です');
        const pref = parsed.data;
        const ymError = validateYearMonth(pref?.yearMonth);
        if (ymError) return createValidationError(ymError);
        const authState = await getRequestAuthState(context.request, context.env.ADMIN_PASSWORD!);
        if (authState.kind === 'staff' && pref.staffId !== authState.staffId) {
            return new Response(
                JSON.stringify({ error: '自分の希望休のみ変更できます' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const details = pref.details || [];
        const hasSubmittedFlag = typeof pref.submitted === 'boolean';
        const submittedValue = pref.submitted === true ? 1 : 0;
        const preferenceId = crypto.randomUUID();

        // Statements for batch execution
        const statements = [];

        // 1. Legacy Upsert (without unavailableDates)
        // UNIQUE(staffId, yearMonth) と組み合わせ、同時保存でも月次行を1件に保つ。
        if (hasSubmittedFlag) {
            statements.push(
                context.env.DB.prepare(
                    `INSERT INTO shift_preferences (id, staffId, yearMonth, submitted)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(staffId, yearMonth) DO UPDATE SET submitted = excluded.submitted
                     RETURNING id`
                ).bind(preferenceId, pref.staffId, pref.yearMonth, submittedValue)
            );
        } else {
            // submitted 省略時は、新規行だけ未提出で作成し、既存の提出状態を維持する。
            statements.push(
                context.env.DB.prepare(
                    `INSERT INTO shift_preferences (id, staffId, yearMonth, submitted)
                     VALUES (?, ?, ?, 0)
                     ON CONFLICT(staffId, yearMonth) DO NOTHING
                     RETURNING id`
                ).bind(preferenceId, pref.staffId, pref.yearMonth)
            );
        }

        // 2. Normalized Reset (Delete and Re-insert)
        statements.push(
            context.env.DB.prepare(
                "DELETE FROM shift_preference_dates WHERE staffId = ? AND yearMonth = ?"
            ).bind(pref.staffId, pref.yearMonth)
        );

        details.forEach((d) => {
            statements.push(
                context.env.DB.prepare(
                    "INSERT INTO shift_preference_dates (id, staffId, yearMonth, date, startTime, endTime, type) VALUES (?, ?, ?, ?, ?, ?, ?)"
                ).bind(crypto.randomUUID(), pref.staffId, pref.yearMonth, d.date, d.startTime ?? null, d.endTime ?? null, d.type || null)
            );
        });

        const [monthlyResult] = await context.env.DB.batch<D1Row>(statements);
        const created = monthlyResult.results?.some(row => row.id === preferenceId) ?? false;
        await writeAuditLog(context.env, context.request, { action: created ? 'create' : 'update', entityType: 'shift_preference', entityId: pref.staffId, yearMonth: pref.yearMonth, summary: '希望休を保存', after: { staffId: pref.staffId, submitted: pref.submitted, details }, metadata: { detailCount: details.length } });
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'POST /preferences');
    }
};

// PATCH: submitted フラグのみ更新（管理者が提出済み状態を手動で変更する用途）
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ShiftPreferenceSubmissionSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('提出状態の入力内容が不正です');
        const body = parsed.data;
        const ymError = validateYearMonth(body?.yearMonth);
        if (ymError) return createValidationError(ymError);

        if (!body.staffId) return createValidationError('staffId は必須です');
        if (typeof body.submitted !== 'boolean') return createValidationError('submitted は boolean 型で指定してください');

        const submittedValue = body.submitted ? 1 : 0;

        await context.env.DB.prepare(
            `INSERT INTO shift_preferences (id, staffId, yearMonth, submitted)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(staffId, yearMonth) DO UPDATE SET submitted = excluded.submitted`
        ).bind(`pref_${crypto.randomUUID()}`, body.staffId, body.yearMonth, submittedValue).run();

        await writeAuditLog(context.env, context.request, { action: 'update', entityType: 'preference_submission', entityId: body.staffId, yearMonth: body.yearMonth, summary: body.submitted ? '希望休を提出済みに変更' : '希望休を未提出に変更', after: { submitted: body.submitted } });

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'PATCH /preferences');
    }
};
