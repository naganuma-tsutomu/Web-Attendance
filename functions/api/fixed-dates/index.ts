import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';
import type { Env } from '../../types';

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

        return Response.json({ success: true, message: `Successfully updated fixed dates` });
    } catch (e) {
        return handleServerError(e, 'POST /fixed-dates');
    }
};
