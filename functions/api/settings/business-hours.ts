import { handleServerError, createValidationError, safeJsonParse } from '../../utils/validation';
import type { Env } from '../../types';
import { BusinessHoursSchema, formatAppSettingsInputError } from '../../../shared/appSettingsSchemas';

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;
const DEFAULT_CLOSED_DAYS = [0]; // デフォルトは日曜日休館

// GET /api/settings/business-hours — 営業時間・休館日設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT key, value FROM app_settings WHERE key IN ('business_hours_start', 'business_hours_end', 'business_hours_closed_days')`
        ).all<{ key: string, value: string }>();

        const settingsMap = Object.fromEntries(results.map((r: { key: string, value: string }) => [r.key, r.value]));

        const candidate = {
            startHour: settingsMap['business_hours_start'] ? parseFloat(settingsMap['business_hours_start']) : DEFAULT_START_HOUR,
            endHour: settingsMap['business_hours_end'] ? parseFloat(settingsMap['business_hours_end']) : DEFAULT_END_HOUR,
            closedDays: safeJsonParse(settingsMap['business_hours_closed_days'], DEFAULT_CLOSED_DAYS),
        };
        const parsed = BusinessHoursSchema.safeParse(candidate);
        return Response.json(parsed.success ? parsed.data : BusinessHoursSchema.parse({}));
    } catch (e) {
        return handleServerError(e, 'Database error fetching business hours');
    }
};

// PUT /api/settings/business-hours — 営業時間・休館日設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const parsed = BusinessHoursSchema.safeParse(await context.request.json());
        if (!parsed.success) {
            return createValidationError(formatAppSettingsInputError(parsed.error, '営業時間設定の入力内容が不正です'));
        }
        const { startHour, endHour, closedDays } = parsed.data;

        // UPSERT
        await context.env.DB.batch([
            context.env.DB.prepare(
                `INSERT INTO app_settings (key, value) VALUES ('business_hours_start', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
            ).bind(String(startHour)),
            context.env.DB.prepare(
                `INSERT INTO app_settings (key, value) VALUES ('business_hours_end', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
            ).bind(String(endHour)),
            context.env.DB.prepare(
                `INSERT INTO app_settings (key, value) VALUES ('business_hours_closed_days', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
            ).bind(JSON.stringify(closedDays)),
        ]);

        return Response.json({ success: true, startHour, endHour, closedDays });
    } catch (e) {
        return handleServerError(e, 'Database error updating business hours');
    }
};
