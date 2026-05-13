import { handleServerError } from '../../utils/validation';
import type { Env } from '../../types';

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
        const body = await context.request.json() as Partial<typeof DEFAULT_SCHEDULE_PREFERENCES>;
        const next = {
            ...DEFAULT_SCHEDULE_PREFERENCES,
            autoOpenGenerationReport: body.autoOpenGenerationReport !== false,
        };

        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('schedule_preferences', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(JSON.stringify(next)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating schedule preferences');
    }
};
