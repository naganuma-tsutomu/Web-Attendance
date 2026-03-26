import { handleServerError, createValidationError } from '../../utils/validation';
import type { Env } from '../../types';

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;

// GET /api/settings/business-hours — 営業時間設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        // app_settings テーブルが存在しない場合は自動作成
        await context.env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )`
        ).run();

        const startRow = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'business_hours_start'`
        ).first<{ value: string }>();

        const endRow = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'business_hours_end'`
        ).first<{ value: string }>();

        return Response.json({
            startHour: startRow ? parseInt(startRow.value, 10) : DEFAULT_START_HOUR,
            endHour: endRow ? parseInt(endRow.value, 10) : DEFAULT_END_HOUR,
        });
    } catch (e) {
        return handleServerError(e, 'Database error fetching business hours');
    }
};

// PUT /api/settings/business-hours — 営業時間設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as { startHour?: number; endHour?: number };

        const startHour = body.startHour ?? DEFAULT_START_HOUR;
        const endHour = body.endHour ?? DEFAULT_END_HOUR;

        // バリデーション
        if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
            return createValidationError('開始時間は0〜23の整数で指定してください');
        }
        if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24) {
            return createValidationError('終了時間は1〜24の整数で指定してください');
        }
        if (startHour >= endHour) {
            return createValidationError('開始時間は終了時間より前に設定してください');
        }
        if (endHour - startHour < 2) {
            return createValidationError('営業時間は最低2時間必要です');
        }

        // app_settings テーブルが存在しない場合は自動作成
        await context.env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )`
        ).run();

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
        ]);

        return Response.json({ success: true, startHour, endHour });
    } catch (e) {
        return handleServerError(e, 'Database error updating business hours');
    }
};
