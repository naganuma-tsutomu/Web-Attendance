import { createValidationError, handleServerError } from '../../../utils/validation';
import type { Env } from '../../../types';
import { writeAuditLog } from '../../../utils/auditLog';
import { BusinessDayOverrideBulkSchema } from '../../../../shared/calendarRequestSchemas';

const enumerateDates = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = BusinessDayOverrideBulkSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('一括設定の入力内容が不正です');
        const body = parsed.data;
        const dates = enumerateDates(body.startDate!, body.endDate!);
        if (dates.length > 31) return createValidationError('一括登録は31日以内で指定してください');

        const placeholders = dates.map(() => '?').join(', ');
        const { results: existing } = await context.env.DB.prepare(
            `SELECT date FROM business_day_overrides WHERE date IN (${placeholders}) ORDER BY date`
        ).bind(...dates).all<{ date: string }>();
        if (existing.length > 0) {
            return Response.json({
                error: '期間内に既存の個別設定があります',
                dates: existing.map(item => item.date),
            }, { status: 409 });
        }

        const ids = dates.map(() => `bdo_${crypto.randomUUID()}`);
        const statements = dates.map((date, index) => context.env.DB.prepare(
            'INSERT INTO business_day_overrides (id, date, status, name) VALUES (?, ?, ?, ?)'
        ).bind(ids[index], date, body.status!, (body.name ?? '').trim()));
        await context.env.DB.batch(statements);
        await writeAuditLog(context.env, context.request, { action: 'create', entityType: 'business_day_override_bulk', yearMonth: body.startDate!.slice(0, 7), targetDate: body.startDate, summary: `${ids.length}日分の個別営業日・休業日を一括作成`, after: body, metadata: { endDate: body.endDate, count: ids.length } });
        return Response.json({ ids, count: ids.length }, { status: 201 });
    } catch (e) {
        return handleServerError(e, 'Database error bulk creating business day overrides');
    }
};
