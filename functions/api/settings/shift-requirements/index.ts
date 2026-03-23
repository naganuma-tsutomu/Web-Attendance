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
        const body = await context.request.json() as ShiftRequirement | ShiftRequirement[];

        // 配列に変換（単一オブジェクトの場合も配列に）
        const requirements = Array.isArray(body) ? body : [body];

        // バリデーション
        for (const req of requirements) {
            if (!req.classId || req.classId.trim().length === 0) {
                return createValidationError('クラスIDを指定してください');
            }

            const dayError = validateDayOfWeek(req.dayOfWeek);
            if (dayError) return createValidationError(dayError);

            const timeError = validateTimeRange(req.startTime, req.endTime);
            if (timeError) return createValidationError(timeError);

            const minStaffError = validateMinStaffCount(req.minStaffCount);
            if (minStaffError) return createValidationError(minStaffError);

            const maxStaffError = validateMaxStaffCount(req.maxStaffCount, req.minStaffCount);
            if (maxStaffError) return createValidationError(maxStaffError);
        }

        if (requirements.length === 0) {
            return createValidationError('シフト要件を1件以上指定してください');
        }

        const statements = [context.env.DB.prepare('DELETE FROM shift_requirements')];
        const savedIds: string[] = [];

        for (const req of requirements) {
            const id = (!req.id || req.id.startsWith('temp-'))
                ? `req_${crypto.randomUUID()}`
                : req.id;

            statements.push(
                context.env.DB.prepare(
                    `INSERT INTO shift_requirements
                     (id, classId, dayOfWeek, startTime, endTime, minStaffCount, maxStaffCount, priority)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id,
                    req.classId.trim(),
                    req.dayOfWeek,
                    req.startTime,
                    req.endTime,
                    req.minStaffCount,
                    req.maxStaffCount ?? null,
                    req.priority ?? 0
                )
            );

            savedIds.push(id);
        }

        // batch() はトランザクション保証あり（失敗時は全ロールバック）
        await context.env.DB.batch(statements);

        return Response.json({ ids: savedIds, count: savedIds.length }, { status: 201 });
    } catch (e) {
        return handleServerError(e, 'Database error creating shift requirements');
    }
};
