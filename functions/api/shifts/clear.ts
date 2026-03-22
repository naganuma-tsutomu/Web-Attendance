import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body: { yearMonth: string, exceptDates?: string[] } = await context.request.json();
        const { yearMonth, exceptDates } = body;

        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        if (exceptDates && exceptDates.length > 0) {
            const placeholders = exceptDates.map(() => '?').join(',');
            await context.env.DB.prepare(
                `DELETE FROM shifts WHERE date LIKE ? AND date NOT IN (${placeholders})`
            ).bind(`${yearMonth}%`, ...exceptDates).run();
        } else {
            await context.env.DB.prepare(
                "DELETE FROM shifts WHERE date LIKE ?"
            ).bind(`${yearMonth}%`).run();
        }

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'POST /shifts/clear');
    }
};
