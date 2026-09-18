import { createValidationError, handleServerError, validateDate } from '../../utils/validation';
import type { Env } from '../../types';
import { writeAuditLog } from '../../utils/auditLog';
import { ShiftRangeDeleteSchema } from '../../../shared/shiftRequestSchemas';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const parsed = ShiftRangeDeleteSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('削除期間の入力内容が不正です');
        const body = parsed.data;
        const startError = validateDate(body.startDate, '開始日');
        if (startError) return createValidationError(startError);
        const endError = validateDate(body.endDate, '終了日');
        if (endError) return createValidationError(endError);
        if (body.startDate! > body.endDate!) return createValidationError('終了日は開始日以降にしてください');

        const result = await context.env.DB.prepare(
            'DELETE FROM shifts WHERE date >= ? AND date <= ?'
        ).bind(body.startDate!, body.endDate!).run();
        await writeAuditLog(context.env, context.request, { action: 'delete', entityType: 'shift_range', yearMonth: body.startDate!.slice(0, 7), targetDate: body.startDate, summary: `${body.startDate}〜${body.endDate}のシフトを削除`, metadata: { endDate: body.endDate, count: result.meta.changes ?? 0 } });
        return Response.json({ deletedCount: result.meta.changes ?? 0 });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shifts by date range');
    }
};
