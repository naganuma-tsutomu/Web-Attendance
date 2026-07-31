import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as createShifts } from '../../../functions/api/shifts/index';
import { onRequestPut as updateShift } from '../../../functions/api/shifts/[id]';

type Row = Record<string, unknown>;

const makeStatement = (sql: string, rows: Row[]) => {
    const statement = {
        sql,
        binds: [] as unknown[],
        bind: (...values: unknown[]) => {
            statement.binds = values;
            return statement;
        },
        all: async () => ({ results: rows }),
        first: async () => rows[0] ?? null,
        run: async () => ({ success: true }),
    };
    return statement;
};

describe('shift API integrity validation', () => {
    it('一括追加リクエスト内の重複を409で拒否する', async () => {
        const batch = vi.fn();
        const db = {
            prepare: (sql: string) => makeStatement(sql, []),
            batch,
        };
        const context = {
            request: {
                json: async () => [
                    { date: '2026-08-03', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'a' },
                    { date: '2026-08-03', staffId: 's1', startTime: '10:00', endTime: '12:00', classType: 'b' },
                ],
            },
            env: { DB: db },
        };

        const response = await createShifts(context as never);

        expect(response.status).toBe(409);
        expect(batch).not.toHaveBeenCalled();
    });

    it('一括追加時にDBの既存シフトと重なる場合は409で拒否する', async () => {
        const batch = vi.fn();
        const db = {
            prepare: (sql: string) => makeStatement(sql, sql.includes('FROM shifts')
                ? [{
                    id: 'existing',
                    date: '2026-08-03',
                    staffId: 's1',
                    startTime: '09:00',
                    endTime: '12:00',
                    classType: 'a',
                    isError: 0,
                }]
                : []),
            batch,
        };
        const context = {
            request: {
                json: async () => [
                    { date: '2026-08-03', staffId: 's1', startTime: '11:00', endTime: '15:00', classType: 'b' },
                ],
            },
            env: { DB: db },
        };

        const response = await createShifts(context as never);

        expect(response.status).toBe(409);
        expect(batch).not.toHaveBeenCalled();
    });

    it('境界が接する追加シフトは許可する', async () => {
        const batch = vi.fn().mockResolvedValue([]);
        const db = {
            prepare: (sql: string) => makeStatement(sql, sql.includes('FROM shifts')
                ? [{
                    id: 'existing',
                    date: '2026-08-03',
                    staffId: 's1',
                    startTime: '09:00',
                    endTime: '12:00',
                    classType: 'a',
                    isError: 0,
                }]
                : []),
            batch,
        };
        const context = {
            request: {
                json: async () => [
                    { date: '2026-08-03', staffId: 's1', startTime: '12:00', endTime: '15:00', classType: 'b' },
                ],
            },
            env: { DB: db },
        };

        const response = await createShifts(context as never);

        expect(response.status).toBe(200);
        expect(batch).toHaveBeenCalledTimes(1);
    });

    it('編集後に別シフトと重なる場合は409で拒否する', async () => {
        const run = vi.fn();
        const db = {
            prepare: (sql: string) => {
                if (sql.includes('FROM shifts WHERE id = ?')) {
                    return makeStatement(sql, [{
                        id: 'editing',
                        date: '2026-08-03',
                        staffId: 's1',
                        startTime: '12:00',
                        endTime: '15:00',
                        classType: 'b',
                        isError: 0,
                    }]);
                }
                if (sql.includes('id <> ?')) {
                    return makeStatement(sql, [{
                        id: 'existing',
                        date: '2026-08-03',
                        staffId: 's1',
                        startTime: '09:00',
                        endTime: '12:00',
                        classType: 'a',
                        isError: 0,
                    }]);
                }
                const statement = makeStatement(sql, []);
                statement.run = async () => {
                    run();
                    return { success: true };
                };
                return statement;
            },
        };
        const context = {
            params: { id: 'editing' },
            request: { json: async () => ({ startTime: '11:00' }) },
            env: { DB: db },
        };

        const response = await updateShift(context as never);

        expect(response.status).toBe(409);
        expect(run).not.toHaveBeenCalled();
    });
});
