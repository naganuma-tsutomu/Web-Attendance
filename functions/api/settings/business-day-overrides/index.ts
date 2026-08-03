import { createValidationError, handleServerError, validateDate, validateYearMonth } from '../../../utils/validation';
import type { Env } from '../../../types';

type OverrideInput = { date?: string; status?: string; name?: string };

const validateInput = (body: OverrideInput): string | null => {
    const dateError = validateDate(body.date, '日付');
    if (dateError) return dateError;
    if (body.status !== 'open' && body.status !== 'closed') {
        return '営業状態はopenまたはclosedで指定してください';
    }
    if (body.name !== undefined && typeof body.name !== 'string') return '理由は文字列で入力してください';
    if ((body.name ?? '').trim().length > 100) return '理由は100文字以内で入力してください';
    return null;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearMonth = url.searchParams.get('yearMonth');
        const year = url.searchParams.get('year');
        let query = 'SELECT * FROM business_day_overrides';
        const params: string[] = [];

        if (yearMonth) {
            const error = validateYearMonth(yearMonth);
            if (error) return createValidationError(error);
            const [y, m] = yearMonth.split('-').map(Number);
            const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
            query += ' WHERE date >= ? AND date < ?';
            params.push(`${yearMonth}-01`, `${next}-01`);
        } else if (year) {
            if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) {
                return createValidationError('yearは2000〜2100の4桁で指定してください');
            }
            query += ' WHERE date >= ? AND date < ?';
            params.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
        }

        query += ' ORDER BY date';
        const { results } = await context.env.DB.prepare(query).bind(...params).all();
        return Response.json(results);
    } catch (e) {
        return handleServerError(e, 'Database error fetching business day overrides');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as OverrideInput;
        const error = validateInput(body);
        if (error) return createValidationError(error);

        const id = `bdo_${crypto.randomUUID()}`;
        await context.env.DB.prepare(
            'INSERT INTO business_day_overrides (id, date, status, name) VALUES (?, ?, ?, ?)'
        ).bind(id, body.date!, body.status!, (body.name ?? '').trim()).run();
        return Response.json({ id }, { status: 201 });
    } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
            return createValidationError('指定された日付には既に個別設定があります');
        }
        return handleServerError(e, 'Database error creating business day override');
    }
};
