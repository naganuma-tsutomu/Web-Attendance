import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as clearShifts } from '../../../functions/api/shifts/clear';
import { onRequestDelete as clearShiftRange } from '../../../functions/api/shifts/range';

const makeStatement = (sql: string) => {
    const statement = {
        sql,
        binds: [] as unknown[],
        bind: (...values: unknown[]) => {
            statement.binds = values;
            return statement;
        },
    };
    return statement;
};

describe('shift clear API', () => {
    it('ロック済み日を除外してシフトを削除する', async () => {
        const batch = vi.fn().mockResolvedValue([]);
        const context = {
            request: {
                json: async () => ({
                    yearMonth: '2026-08',
                    exceptDates: ['2026-08-10'],
                }),
            },
            env: {
                DB: {
                    prepare: (sql: string) => makeStatement(sql),
                    batch,
                },
            },
        };

        const response = await clearShifts(context as never);
        const statements = batch.mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(statements).toHaveLength(1);
        expect(statements[0].sql).toContain('date NOT IN (?)');
        expect(statements[0].binds).toEqual([
            '2026-08-01',
            '2026-09-01',
            '2026-08-10',
        ]);
    });

    it('ロック済みを含める場合はシフトとロックを同じバッチで削除する', async () => {
        const batch = vi.fn().mockResolvedValue([]);
        const context = {
            request: {
                json: async () => ({
                    yearMonth: '2026-08',
                    exceptDates: [],
                    clearFixedDates: true,
                }),
            },
            env: {
                DB: {
                    prepare: (sql: string) => makeStatement(sql),
                    batch,
                },
            },
        };

        const response = await clearShifts(context as never);
        const statements = batch.mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(statements).toHaveLength(2);
        expect(statements[0].sql).toContain('DELETE FROM shifts');
        expect(statements[1].sql).toContain('DELETE FROM fixed_dates');
        expect(statements[1].binds).toEqual(['2026-08']);
    });
});

describe('shift date range delete API', () => {
    it('指定期間だけを削除して件数を返す', async () => {
        const statement = {
            ...makeStatement('DELETE FROM shifts WHERE date >= ? AND date <= ?'),
            run: vi.fn().mockResolvedValue({ meta: { changes: 4 } }),
        };
        statement.bind = (...values: unknown[]) => {
            statement.binds = values;
            return statement;
        };
        const response = await clearShiftRange({
            request: { json: async () => ({ startDate: '2026-08-13', endDate: '2026-08-15' }) },
            env: { DB: { prepare: () => statement } },
        } as never);

        expect(response.status).toBe(200);
        expect(statement.binds).toEqual(['2026-08-13', '2026-08-15']);
        await expect(response.json()).resolves.toEqual({ deletedCount: 4 });
    });

    it('終了日が開始日より前なら削除しない', async () => {
        const prepare = vi.fn();
        const response = await clearShiftRange({
            request: { json: async () => ({ startDate: '2026-08-15', endDate: '2026-08-13' }) },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
    });
});
