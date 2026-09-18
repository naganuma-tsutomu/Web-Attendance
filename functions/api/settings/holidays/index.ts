import { handleServerError, createValidationError, validateName, validateYear } from '../../../utils/validation';
import type { D1BindParam, Env } from '../../../types';
import { HolidayCreateSchema } from '../../../../shared/calendarRequestSchemas';

// GET /api/holidays — 祝日一覧取得
// Query: ?year=2025 (年指定、省略時は全件)
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const year = url.searchParams.get('year');
        
        let query = 'SELECT * FROM holidays';
        const params: D1BindParam[] = [];
        
        if (year !== null) {
            const yearError = validateYear(year);
            if (yearError) return createValidationError(yearError);
            query += ' WHERE date >= ? AND date < ?';
            params.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
        }
        
        query += ' ORDER BY date';
        
        const { results: holidays } = await context.env.DB.prepare(query).bind(...params).all<Record<string, unknown>>();
        return Response.json(holidays.map(holiday => ({
            ...holiday,
            isWorkday: Boolean(holiday.is_workday),
        })));
    } catch (e) { 
        return handleServerError(e, 'Database error fetching holidays'); 
    }
};

// POST /api/holidays — 祝日登録（手動追加用）
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = HolidayCreateSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('祝日の入力内容が不正です');
        const body = parsed.data;
        
        // Validate name
        const nameError = validateName(body.name, '祝日名', 100);
        if (nameError) return createValidationError(nameError);
        
        const id = `hol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const type = body.type || 'national';
        const isWorkday = body.isWorkday ? 1 : 0;
        
        await context.env.DB.prepare(
            'INSERT INTO holidays (id, date, name, type, is_workday) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, body.date, body.name.trim(), type, isWorkday).run();
        
        return Response.json({ id }, { status: 201 });
    } catch (e) { 
        if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) {
            return createValidationError('指定された日付の祝日は既に登録されています');
        }
        return handleServerError(e, 'Database error creating holiday'); 
    }
};
