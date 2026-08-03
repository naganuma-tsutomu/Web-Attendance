import { createValidationError, handleServerError, validateDate } from '../../../utils/validation';
import type { Env } from '../../../types';

type BulkInput = { startDate?: string; endDate?: string; status?: string; name?: string };

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
        const body = await context.request.json() as BulkInput;
        const startError = validateDate(body.startDate, '開始日');
        if (startError) return createValidationError(startError);
        const endError = validateDate(body.endDate, '終了日');
        if (endError) return createValidationError(endError);
        if (body.startDate! > body.endDate!) return createValidationError('終了日は開始日以降にしてください');
        if (body.status !== 'open' && body.status !== 'closed') {
            return createValidationError('営業状態はopenまたはclosedで指定してください');
        }
        if (body.name !== undefined && typeof body.name !== 'string') return createValidationError('理由は文字列で入力してください');
        if ((body.name ?? '').trim().length > 100) return createValidationError('理由は100文字以内で入力してください');

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
        return Response.json({ ids, count: ids.length }, { status: 201 });
    } catch (e) {
        return handleServerError(e, 'Database error bulk creating business day overrides');
    }
};
