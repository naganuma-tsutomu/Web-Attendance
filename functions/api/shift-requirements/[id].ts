import type { ShiftRequirement } from '../../../src/types';
import { 
    handleServerError, 
    createValidationError, 
    validateTimeFormat, 
    validateTimeRange, 
    validateDayOfWeek, 
    validateMinStaffCount, 
    validateMaxStaffCount 
} from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

// PUT /api/shift-requirements/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        const body = await context.request.json() as Partial<ShiftRequirement>;
        
        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        
        // Validate and add classId
        if (body.classId !== undefined) {
            if (body.classId.trim().length === 0) {
                return createValidationError('クラスIDを指定してください');
            }
            updates.push('classId = ?');
            values.push(body.classId.trim());
        }
        
        // Validate and add dayOfWeek
        if (body.dayOfWeek !== undefined) {
            const dayError = validateDayOfWeek(body.dayOfWeek);
            if (dayError) return createValidationError(dayError);
            updates.push('dayOfWeek = ?');
            values.push(body.dayOfWeek);
        }
        
        // Validate time range - need to handle partial updates
        if (body.startTime !== undefined || body.endTime !== undefined) {
            // Fetch current values for partial updates
            const current = await context.env.DB.prepare(
                'SELECT startTime, endTime FROM shift_requirements WHERE id = ?'
            ).bind(id).first() as { startTime: string; endTime: string } | null;
            
            const newStartTime = body.startTime ?? current?.startTime;
            const newEndTime = body.endTime ?? current?.endTime;
            
            if (newStartTime && newEndTime) {
                const timeError = validateTimeRange(newStartTime, newEndTime);
                if (timeError) return createValidationError(timeError);
            }
            
            if (body.startTime !== undefined) {
                const formatError = validateTimeFormat(body.startTime, '開始時間');
                if (formatError) return createValidationError(formatError);
                updates.push('startTime = ?');
                values.push(body.startTime);
            }
            
            if (body.endTime !== undefined) {
                const formatError = validateTimeFormat(body.endTime, '終了時間');
                if (formatError) return createValidationError(formatError);
                updates.push('endTime = ?');
                values.push(body.endTime);
            }
        }
        
        // Validate staff counts - need to handle together for maxStaffCount validation
        if (body.minStaffCount !== undefined || body.maxStaffCount !== undefined) {
            const current = await context.env.DB.prepare(
                'SELECT minStaffCount, maxStaffCount FROM shift_requirements WHERE id = ?'
            ).bind(id).first() as { minStaffCount: number; maxStaffCount: number | null } | null;
            
            const newMinCount = body.minStaffCount ?? current?.minStaffCount ?? 1;
            const newMaxCount = body.maxStaffCount !== undefined ? body.maxStaffCount : current?.maxStaffCount;
            
            if (body.minStaffCount !== undefined) {
                const minError = validateMinStaffCount(body.minStaffCount);
                if (minError) return createValidationError(minError);
                updates.push('minStaffCount = ?');
                values.push(body.minStaffCount);
            }
            
            if (body.maxStaffCount !== undefined) {
                const maxError = validateMaxStaffCount(body.maxStaffCount, newMinCount);
                if (maxError) return createValidationError(maxError);
                updates.push('maxStaffCount = ?');
                values.push(body.maxStaffCount);
            }
        }
        
        // Validate and add priority
        if (body.priority !== undefined) {
            if (typeof body.priority !== 'number' || !Number.isInteger(body.priority)) {
                return createValidationError('優先度は整数値で指定してください');
            }
            if (body.priority < 0 || body.priority > 999) {
                return createValidationError('優先度は0〜999の範囲で指定してください');
            }
            updates.push('priority = ?');
            values.push(body.priority);
        }
        
        if (updates.length === 0) {
            return createValidationError('更新するデータがありません');
        }
        
        values.push(id);
        await context.env.DB.prepare(
            `UPDATE shift_requirements SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run();
        
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating shift requirement');
    }
};

// DELETE /api/shift-requirements/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id as string;
        
        await context.env.DB.prepare('DELETE FROM shift_requirements WHERE id = ?').bind(id).run();
        
        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting shift requirement');
    }
};
