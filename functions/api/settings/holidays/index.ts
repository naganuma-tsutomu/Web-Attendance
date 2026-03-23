export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateName } from '../../../utils/validation';

// GET /api/holidays — 祝日一覧取得
// Query: ?year=2025 (年指定、省略時は全件)
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const year = url.searchParams.get('year');
        
        let query = 'SELECT * FROM holidays';
        const params: any[] = [];
        
        if (year) {
            query += ' WHERE date >= ? AND date < ?';
            params.push(`${year}-01-01`, `${Number(year) + 1}-01-01`);
        }
        
        query += ' ORDER BY date';
        
        const { results: holidays } = await context.env.DB.prepare(query).bind(...params).all();
        return Response.json(holidays);
    } catch (e) { 
        return handleServerError(e, 'Database error fetching holidays'); 
    }
};

// POST /api/holidays — 祝日登録（手動追加用）
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { 
            date: string;      // YYYY-MM-DD
            name: string;      // 祝日名
            type?: string;     // 'national', 'observance', 'company' (default: 'national')
            isWorkday?: boolean; // 振替休日等 (default: false)
        };
        
        // Validate date
        if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
            return createValidationError('日付はYYYY-MM-DD形式で指定してください');
        }
        
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
