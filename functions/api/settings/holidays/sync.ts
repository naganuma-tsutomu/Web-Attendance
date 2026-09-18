import { createValidationError, handleServerError, validateYear } from '../../../utils/validation';
import holiday_jp from '@holiday-jp/holiday_jp';
import type { Env } from '../../../types';

type SyncedHoliday = { id: string; date: string; name: string };

// POST /api/holidays/sync — 外部データと同期（@holiday-jp/holiday_jpパッケージ使用）
// Query: ?year=2025 (年指定、省略時は今年と来年)
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearParam = url.searchParams.get('year');
        if (yearParam !== null) {
            const yearError = validateYear(yearParam);
            if (yearError) return createValidationError(yearError);
        }
        
        const currentYear = new Date().getFullYear();
        const years = yearParam 
            ? [Number(yearParam)]
            : [currentYear, currentYear + 1];
        
        const holidaysToSync: SyncedHoliday[] = [];
        
        for (const year of years) {
            // @holiday-jp/holiday_jpから祝日データを取得
            const holidays = holiday_jp.between(
                new Date(year, 0, 1),    // 1月1日
                new Date(year, 11, 31)   // 12月31日
            );
            
            for (const holiday of holidays) {
                const dateStr = holiday.date.toISOString().split('T')[0]; // YYYY-MM-DD
                const id = `hol_${year}_${dateStr.replace(/-/g, '')}`;
                holidaysToSync.push({ id, date: dateStr, name: holiday.name });
            }
        }

        // 祝日ごとの逐次D1アクセスを避け、1回のトランザクションで同期する。
        const statements = holidaysToSync.map(holiday => context.env.DB.prepare(
            `INSERT OR IGNORE INTO holidays (id, date, name, type, is_workday)
             VALUES (?, ?, ?, 'national', 0)`
        ).bind(holiday.id, holiday.date, holiday.name));
        const batchResults = statements.length > 0
            ? await context.env.DB.batch(statements)
            : [];
        const synced = batchResults.reduce(
            (count, result) => count + (Number(result.meta.changes ?? 0) > 0 ? 1 : 0),
            0,
        );
        const skipped = holidaysToSync.length - synced;
        
        return Response.json({
            success: true,
            message: `同期完了: ${synced}件追加, ${skipped}件スキップ`,
            synced,
            skipped,
            errors: [],
            holidays: holidaysToSync,
        });
    } catch (e) { 
        return handleServerError(e, 'Holiday sync failed'); 
    }
};
