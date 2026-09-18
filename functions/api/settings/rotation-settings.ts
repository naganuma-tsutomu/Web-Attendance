import { createValidationError, handleServerError } from '../../utils/validation';
import type { Env } from '../../types';
import {
    formatRotationSettingsInputError,
    RotationSettingsRequestSchema,
} from '../../../shared/appSettingsSchemas';
import { loadRotationSettings } from '../../utils/rotationSettings';

// GET /api/settings/rotation-settings — ローテーション設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        return Response.json(await loadRotationSettings(context.env.DB));
    } catch (e) {
        return handleServerError(e, 'Database error fetching rotation settings');
    }
};

// PUT /api/settings/rotation-settings — ローテーション設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const parsed = RotationSettingsRequestSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError(formatRotationSettingsInputError(parsed.error));

        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('rotation_settings', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(JSON.stringify(parsed.data)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating rotation settings');
    }
};
