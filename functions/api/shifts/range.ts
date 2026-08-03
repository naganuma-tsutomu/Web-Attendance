import { createValidationError, handleServerError, validateDate } from '../../utils/validation';
import type { Env } from '../../types';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { startDate?: string; endDate?: string };
        const startError = validateDate(body.startDate, '開始日');
        if (startError) return createValidationError(startError);
        const endError = validateDate(body.endDate, '終了日');
        if (endError) return createValidationError(endError);
        if (body.startDate! > body.endDate!) return createValidationError('終了日は開始日以降にしてください');

        const result = await context.env.DB.prepare(
            'DELETE FROM shifts WHERE date >= ? AND date <= ?'
        ).bind(body.startDate!, body.endDate!).run();
        return Response.json({ deletedCount: result.meta.changes ?? 0 });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shifts by date range');
    }
};
