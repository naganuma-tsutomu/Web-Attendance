import { handleServerError, createValidationError } from '../../utils/validation';
import type { Env } from '../../types';

const DEFAULT_FACILITY_NAME = '施設名未設定';

// GET /api/settings/facility — 施設名を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const row = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'facility_name'`
        ).first<{ value: string }>();

        return Response.json({ name: row?.value ?? DEFAULT_FACILITY_NAME });
    } catch (e) {
        return handleServerError(e, 'Database error fetching facility name');
    }
};

// PUT /api/settings/facility — 施設名を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { name?: string };
        const name = body.name?.trim();

        if (!name) {
            return createValidationError('施設名を入力してください');
        }
        if (name.length > 50) {
            return createValidationError('施設名は50文字以内で入力してください');
        }

        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('facility_name', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(name).run();

        return Response.json({ success: true, name });
    } catch (e) {
        return handleServerError(e, 'Database error updating facility name');
    }
};
