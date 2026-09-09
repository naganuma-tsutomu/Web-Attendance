import { createValidationError, handleServerError } from '../../utils/validation';
import type { Env } from '../../types';
import { formatAppSettingsInputError, SchedulePreferencesSchema } from '../../../shared/appSettingsSchemas';

const DEFAULT_SCHEDULE_PREFERENCES = {
    autoOpenGenerationReport: true,
};

// GET /api/settings/schedule-preferences — シフト画面設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'schedule_preferences'`
        ).all<{ value: string }>();

        if (results.length === 0) {
            return Response.json(DEFAULT_SCHEDULE_PREFERENCES);
        }

        return Response.json({
            ...DEFAULT_SCHEDULE_PREFERENCES,
            ...JSON.parse(results[0].value),
        });
    } catch (e) {
        return handleServerError(e, 'Database error fetching schedule preferences');
    }
};

// PUT /api/settings/schedule-preferences — シフト画面設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const parsed = SchedulePreferencesSchema.safeParse(await context.request.json());
        if (!parsed.success) {
            return createValidationError(formatAppSettingsInputError(parsed.error, 'シフト画面設定の入力内容が不正です'));
        }

        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('schedule_preferences', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(JSON.stringify(parsed.data)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating schedule preferences');
    }
};
