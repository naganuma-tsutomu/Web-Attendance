import { handleServerError, createValidationError } from '../../utils/validation';
import type { Env } from '../../types';

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

        let closedDays = DEFAULT_CLOSED_DAYS;
        if (settingsMap['business_hours_closed_days']) {
            try {
                closedDays = JSON.parse(settingsMap['business_hours_closed_days']);
            } catch (e) {
                console.error("Failed to parse closed_days", e);
            }
        }

        return Response.json({
            startHour: settingsMap['business_hours_start'] ? parseFloat(settingsMap['business_hours_start']) : DEFAULT_START_HOUR,
            endHour: settingsMap['business_hours_end'] ? parseFloat(settingsMap['business_hours_end']) : DEFAULT_END_HOUR,
            closedDays: closedDays,
        });
    } catch (e) {
        return handleServerError(e, 'Database error fetching business hours');
    }
};

// PUT /api/settings/business-hours — 営業時間・休館日設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { startHour?: number; endHour?: number; closedDays?: number[] };

        const startHour = body.startHour ?? DEFAULT_START_HOUR;
        const endHour = body.endHour ?? DEFAULT_END_HOUR;
        const closedDays = body.closedDays ?? DEFAULT_CLOSED_DAYS;

        // バリデーション (30分刻みを許容: 0, 0.5, 1, 1.5, ...)
        if (typeof startHour !== 'number' || startHour % 0.5 !== 0 || startHour < 0 || startHour > 23.5) {
            return createValidationError('開始時間は0〜23:30の30分刻みで指定してください');
        }
        if (typeof endHour !== 'number' || endHour % 0.5 !== 0 || endHour < 0.5 || endHour > 24) {
            return createValidationError('終了時間は0:30〜24:00の30分刻みで指定してください');
        }
        if (startHour >= endHour) {
            return createValidationError('開始時間は終了時間より前に設定してください');
        }
        if (endHour - startHour < 2) {
            return createValidationError('営業時間は最低2時間必要です');
        }
        if (!Array.isArray(closedDays) || !closedDays.every(d => Number.isInteger(d) && d >= 0 && d <= 7)) {
            return createValidationError('休館日は0〜7の数で指定してください');
        }

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
