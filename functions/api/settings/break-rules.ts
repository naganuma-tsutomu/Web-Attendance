import { createValidationError, handleServerError } from '../../utils/validation';
import type { Env } from '../../types';
import { BreakSettingsSchema, formatAppSettingsInputError } from '../../../shared/appSettingsSchemas';

const DEFAULT_BREAK_SETTINGS = {
    exceptionEnabled: false,
    exceptionThresholdTime: '12:00',
    exceptionBreakMinutes: 30,
    displayActualHoursInModal: false,
    displayActualHoursInExcel: false,
};

// GET /api/settings/break-rules — 休憩設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'break_rules'`
        ).all<{ value: string }>();

        if (results.length === 0) {
            return Response.json(DEFAULT_BREAK_SETTINGS);
        }

        return Response.json(JSON.parse(results[0].value));
    } catch (e) {
        return handleServerError(e, 'Database error fetching break rules');
    }
};

// PUT /api/settings/break-rules — 休憩設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const parsed = BreakSettingsSchema.safeParse(await context.request.json());
        if (!parsed.success) {
            return createValidationError(formatAppSettingsInputError(parsed.error, '休憩設定の入力内容が不正です'));
        }

        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('break_rules', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(JSON.stringify(parsed.data)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating break rules');
    }
};
