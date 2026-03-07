export interface Env {
    DB: D1Database;
}

import { handleServerError, createValidationError } from '../../../utils/validation';

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const role = context.params.role as string;
        const { defaultStartTime, defaultEndTime } = await context.request.json() as any;

        if (!defaultStartTime || !defaultEndTime) {
            return createValidationError('開始時間と終了時間を両方とも指定してください');
        }

        await context.env.DB.prepare(
            "UPDATE role_settings SET defaultStartTime = ?, defaultEndTime = ? WHERE role = ?"
        ).bind(defaultStartTime, defaultEndTime, decodeURIComponent(role)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating role settings');
    }
};
