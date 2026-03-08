import type { ShiftRequirement } from '../../../../src/types';
import { 
    handleServerError, 
    createValidationError, 
    validateTimeRange, 
    validateDayOfWeek, 
    validateMinStaffCount, 
    validateMaxStaffCount 
} from '../../../utils/validation';

export interface Env {
    DB: D1Database;
}

// GET /api/settings/shift-requirements
// Query params: classId, dayOfWeek (optional)
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const classId = url.searchParams.get('classId');
        const dayOfWeekParam = url.searchParams.get('dayOfWeek');
        
        let query = 'SELECT * FROM shift_requirements';
        const conditions: string[] = [];
        const values: any[] = [];
        
        if (classId) {
            conditions.push('classId = ?');
            values.push(classId);
        }
        
        if (dayOfWeekParam !== null) {
            const dayOfWeek = parseInt(dayOfWeekParam, 10);
            conditions.push('dayOfWeek = ?');
            values.push(dayOfWeek);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY dayOfWeek ASC, startTime ASC';
        
        const { results } = await context.env.DB.prepare(query).bind(...values).all();
        return Response.json(results);
    } catch (e) {
        return handleServerError(e, 'Database error fetching shift requirements');
    }
};

// POST /api/settings/shift-requirements
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as ShiftRequirement;
        
        // Validate required fields
        if (!body.classId || body.classId.trim().length === 0) {
            return createValidationError('クラスIDを指定してください');
        }
        
        // Validate dayOfWeek
        const dayError = validateDayOfWeek(body.dayOfWeek);
        if (dayError) return createValidationError(dayError);
        
        // Validate time range
        const timeError = validateTimeRange(body.startTime, body.endTime);
        if (timeError) return createValidationError(timeError);
        
        // Validate minStaffCount
        const minStaffError = validateMinStaffCount(body.minStaffCount);
        if (minStaffError) return createValidationError(minStaffError);
        
        // Validate maxStaffCount (if provided)
        const maxStaffError = validateMaxStaffCount(body.maxStaffCount, body.minStaffCount);
        if (maxStaffError) return createValidationError(maxStaffError);
        
        // Generate ID
        const id = body.id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        
        // Insert into database
        await context.env.DB.prepare(
            `INSERT INTO shift_requirements 
             (id, classId, dayOfWeek, startTime, endTime, minStaffCount, maxStaffCount, priority) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            body.classId.trim(),
            body.dayOfWeek,
            body.startTime,
            body.endTime,
            body.minStaffCount,
            body.maxStaffCount ?? null,
            body.priority ?? 0
        ).run();
        
        return Response.json({ id }, { status: 201 });
    } catch (e) {
        return handleServerError(e, 'Database error creating shift requirement');
    }
};
