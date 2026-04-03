import { handleServerError } from '../../utils/validation';
import type { Env } from '../../types';

// GET /api/settings/excel-settings — Excel出力設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'excel_settings'`
        ).all<{ value: string }>();

        if (results.length === 0) {
            return Response.json({
                excludeHolidayStaffOnSaturdays: false,
                highlightRules: []
            });
        }

        return Response.json(JSON.parse(results[0].value));
    } catch (e) {
        return handleServerError(e, 'Database error fetching excel settings');
    }
};

// PUT /api/settings/excel-settings — Excel出力設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json();
        
        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('excel_settings', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(JSON.stringify(body)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating excel settings');
    }
};
