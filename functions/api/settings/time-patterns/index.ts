export interface Env { DB: D1Database; }

import { handleServerError, createValidationError, validateTimeRange, validateName } from '../../../utils/validation';

// GET /api/settings/time-patterns
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            'SELECT * FROM shift_time_patterns ORDER BY startTime'
        ).all();
        return Response.json(results);
    } catch (e) { 
        return handleServerError(e, 'Database error fetching time patterns'); 
    }
};

// POST /api/settings/time-patterns
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name: string; startTime: string; endTime: string };
        
        // Validate name
        const nameError = validateName(body.name, '名前', 50);
        if (nameError) return createValidationError(nameError);
        
        // Validate time range
        const timeError = validateTimeRange(body.startTime, body.endTime);
        if (timeError) return createValidationError(timeError);
        
        const id = `stp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await context.env.DB.prepare(
            'INSERT INTO shift_time_patterns (id, name, startTime, endTime) VALUES (?, ?, ?, ?)'
        ).bind(id, body.name.trim(), body.startTime, body.endTime).run();
        return Response.json({ id });
    } catch (e) { 
        return handleServerError(e, 'Database error creating time pattern'); 
    }
};
