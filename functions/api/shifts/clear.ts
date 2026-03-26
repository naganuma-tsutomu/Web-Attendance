import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';
import type { Env } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body: { yearMonth: string, exceptDates?: string[] } = await context.request.json();
        const { yearMonth, exceptDates } = body;

        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        if (exceptDates && exceptDates.length > 0) {
            const placeholders = exceptDates.map(() => '?').join(',');
            await context.env.DB.prepare(
                `DELETE FROM shifts WHERE date >= ? AND date < ? AND date NOT IN (${placeholders})`
            ).bind(startStr, nextMonth, ...exceptDates).run();
        } else {
            await context.env.DB.prepare(
                "DELETE FROM shifts WHERE date >= ? AND date < ?"
            ).bind(startStr, nextMonth).run();
        }

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'POST /shifts/clear');
    }
};
