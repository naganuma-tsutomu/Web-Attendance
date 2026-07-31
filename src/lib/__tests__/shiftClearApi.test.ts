import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as clearShifts } from '../../../functions/api/shifts/clear';

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
