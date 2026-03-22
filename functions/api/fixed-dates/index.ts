import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

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

        // Delete all fixed dates for the given month
        await context.env.DB.prepare(
            "DELETE FROM fixed_dates WHERE yearMonth = ?"
        ).bind(yearMonth).run();

        // Insert new fixed dates if any
        if (dates && dates.length > 0) {
            const stmt = context.env.DB.prepare(
                `INSERT INTO fixed_dates (date, yearMonth) VALUES (?, ?)`
            );
            
            const batch = dates.map(date => stmt.bind(date, yearMonth));
            await context.env.DB.batch(batch);
        }

        return Response.json({ success: true, message: `Successfully updated fixed dates` });
    } catch (e) {
        return handleServerError(e, 'POST /fixed-dates');
    }
};
