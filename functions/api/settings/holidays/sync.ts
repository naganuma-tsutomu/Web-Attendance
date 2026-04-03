import { handleServerError } from '../../../utils/validation';
import holiday_jp from '@holiday-jp/holiday_jp';
import type { Env } from '../../../types';

// GET /api/holidays/sync — 外部データと同期（@holiday-jp/holiday_jpパッケージ使用）
// Query: ?year=2025 (年指定、省略時は今年と来年)
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const yearParam = url.searchParams.get('year');
        
        const currentYear = new Date().getFullYear();
        const years = yearParam 
            ? [parseInt(yearParam)] 
            : [currentYear, currentYear + 1];
        
        const results = {
            synced: 0,
            skipped: 0,
            errors: [] as string[],
            holidays: [] as any[]
        };
        
        for (const year of years) {
            // @holiday-jp/holiday_jpから祝日データを取得
            const holidays = holiday_jp.between(
                new Date(year, 0, 1),    // 1月1日
                new Date(year, 11, 31)   // 12月31日
            );
            
            for (const holiday of holidays) {
                const dateStr = holiday.date.toISOString().split('T')[0]; // YYYY-MM-DD
                const id = `hol_${year}_${dateStr.replace(/-/g, '')}`;
                
                // 振替休日かどうかを判定
                const isSubstitute = holiday.name.includes('振替');
                
                try {
                    // INSERT OR IGNOREで重複をスキップ
                    await context.env.DB.prepare(
                        `INSERT OR IGNORE INTO holidays (id, date, name, type, is_workday) 
                         VALUES (?, ?, ?, ?, ?)`
                    ).bind(
                        id,
                        dateStr,
                        holiday.name,
                        'national',
                        isSubstitute ? 0 : 0  // 振替休日も休日扱い
                    ).run();
                    
                    results.holidays.push({
                        date: dateStr,
                        name: holiday.name,
                        id
                    });
                    
                    // 変更があったか確認（簡易的に実装）
                    const { results: existing } = await context.env.DB.prepare(
                        'SELECT id FROM holidays WHERE date = ?'
                    ).bind(dateStr).all();
                    
                    if (existing && existing.length > 0 && existing[0].id === id) {
                        results.synced++;
                    } else {
                        results.skipped++;
                    }
                } catch (err) {
                    results.errors.push(`${dateStr}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            }
        }
        
        return Response.json({
            success: true,
            message: `同期完了: ${results.synced}件追加, ${results.skipped}件スキップ`,
            ...results
        });
    } catch (e) { 
        return handleServerError(e, 'Holiday sync failed'); 
    }
};
