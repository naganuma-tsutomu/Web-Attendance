import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';
import type { Env } from '../../types';
import { writeAuditLog } from '../../utils/auditLog';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const { results } = await context.env.DB.prepare(
            "SELECT date FROM fixed_dates WHERE yearMonth = ?"
        ).bind(yearMonth).all<{date: string}>();

        const dates = results.map(row => row.date);

        return Response.json(dates);
    } catch (e) {
        return handleServerError(e, 'GET /fixed-dates');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body: { yearMonth: string, dates: string[] } = await context.request.json();
        const { yearMonth, dates } = body;

        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        // 重複排除し、date が yearMonth に属するものだけ受け付ける
        // (date PRIMARY KEY の INSERT OR REPLACE で別月の行の yearMonth を上書きしてしまう事故を防止)
        const uniqueDates = Array.from(new Set(dates || [])).filter(d => d.startsWith(yearMonth));

        // DELETE文とINSERT文を1つのバッチ（トランザクション）にまとめる
        const statements = [
            context.env.DB.prepare("DELETE FROM fixed_dates WHERE yearMonth = ?").bind(yearMonth)
        ];

        if (uniqueDates.length > 0) {
            const insertStmt = context.env.DB.prepare(`INSERT OR REPLACE INTO fixed_dates (date, yearMonth) VALUES (?, ?)`);
            statements.push(...uniqueDates.map(date => insertStmt.bind(date, yearMonth)));
        }

        await context.env.DB.batch(statements);

        await writeAuditLog(context.env, context.request, { action: 'update', entityType: 'fixed_dates', yearMonth, summary: `${yearMonth}のロック日を一括更新`, after: uniqueDates, metadata: { count: uniqueDates.length } });

        return Response.json({ success: true, message: `Successfully updated fixed dates` });
    } catch (e) {
        return handleServerError(e, 'POST /fixed-dates');
    }
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
    try {
        const body: { date?: string, fixed?: boolean } = await context.request.json();
        const { date, fixed } = body;

        if (
            typeof date !== 'string' ||
            !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ||
            Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) ||
            new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
        ) {
            return createValidationError('dateはYYYY-MM-DD形式の有効な日付で指定してください');
        }
        if (typeof fixed !== 'boolean') {
            return createValidationError('fixedはbooleanで指定してください');
        }

        const yearMonth = date.slice(0, 7);
        if (fixed) {
            await context.env.DB.prepare(
                'INSERT OR REPLACE INTO fixed_dates (date, yearMonth) VALUES (?, ?)'
            ).bind(date, yearMonth).run();
        } else {
            await context.env.DB.prepare(
                'DELETE FROM fixed_dates WHERE date = ?'
            ).bind(date).run();
        }

        await writeAuditLog(context.env, context.request, { action: fixed ? 'lock' : 'unlock', entityType: 'fixed_date', entityId: date, yearMonth, targetDate: date, summary: fixed ? `${date}をロック` : `${date}のロックを解除` });

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'PATCH /fixed-dates');
    }
};
