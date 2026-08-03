import { createValidationError, handleServerError, validateYearMonth } from '../../utils/validation';
import type { Env } from '../../types';
import { writeAuditLog } from '../../utils/auditLog';

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body: {
            yearMonth: string;
            exceptDates?: string[];
            clearFixedDates?: boolean;
        } = await context.request.json();
        const { yearMonth, exceptDates, clearFixedDates = false } = body;

        const ymError = validateYearMonth(yearMonth);
        if (ymError) return createValidationError(ymError);

        const [y, m] = yearMonth.split('-').map(Number);
        const startStr = `${yearMonth}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const statements = [];
        if (exceptDates && exceptDates.length > 0) {
            const placeholders = exceptDates.map(() => '?').join(',');
            statements.push(context.env.DB.prepare(
                `DELETE FROM shifts WHERE date >= ? AND date < ? AND date NOT IN (${placeholders})`
            ).bind(startStr, nextMonth, ...exceptDates));
        } else {
            statements.push(context.env.DB.prepare(
                "DELETE FROM shifts WHERE date >= ? AND date < ?"
            ).bind(startStr, nextMonth));
        }

        if (clearFixedDates) {
            statements.push(
                context.env.DB.prepare(
                    'DELETE FROM fixed_dates WHERE yearMonth = ?'
                ).bind(yearMonth)
            );
        }

        await context.env.DB.batch(statements);

        await writeAuditLog(context.env, context.request, { action: 'delete', entityType: 'shift_month', yearMonth, summary: `${yearMonth}のシフトを消去`, metadata: { exceptDates: exceptDates ?? [], clearFixedDates } });

        return Response.json({ success: true, message: 'Deleted' });
    } catch (e) {
        return handleServerError(e, 'POST /shifts/clear');
    }
};
