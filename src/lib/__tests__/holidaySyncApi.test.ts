import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as syncHolidays } from '../../../functions/api/settings/holidays/sync';

type MockStatement = {
    sql: string;
    binds: unknown[];
    bind: (...values: unknown[]) => MockStatement;
};

describe('holiday sync API', () => {
    it('対象年の祝日を1回のD1 batchで同期する', async () => {
        const statements: MockStatement[] = [];
        const prepare = vi.fn((sql: string) => {
            const statement: MockStatement = {
                sql,
                binds: [],
                bind: (...values: unknown[]) => {
                    statement.binds = values;
                    return statement;
                },
            };
            statements.push(statement);
            return statement;
        });
        const batch = vi.fn(async (items: MockStatement[]) => items.map((_, index) => ({
            meta: { changes: index === 0 ? 1 : 0 },
        })));

        const response = await syncHolidays({
            request: { url: 'https://example.com/api/settings/holidays/sync?year=2026' },
            env: { DB: { prepare, batch } },
        } as never);
        const body = await response.json() as { synced: number; skipped: number; holidays: unknown[] };

        expect(response.status).toBe(200);
        expect(statements.length).toBeGreaterThan(0);
        expect(batch).toHaveBeenCalledTimes(1);
        expect(batch).toHaveBeenCalledWith(statements);
        expect(body.synced).toBe(1);
        expect(body.skipped).toBe(body.holidays.length - 1);
    });

    it('不正な年ではD1へアクセスしない', async () => {
        const prepare = vi.fn();
        const batch = vi.fn();
        const response = await syncHolidays({
            request: { url: 'https://example.com/api/settings/holidays/sync?year=1999' },
            env: { DB: { prepare, batch } },
        } as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
        expect(batch).not.toHaveBeenCalled();
    });
});
