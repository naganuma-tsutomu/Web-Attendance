import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as createRole } from '../../../functions/api/settings/roles/index';
import { onRequestPut as updateRole } from '../../../functions/api/settings/roles/[id]';
import { onRequestPost as createTimePattern } from '../../../functions/api/settings/time-patterns/index';
import { onRequestPut as updateTimePattern } from '../../../functions/api/settings/time-patterns/[id]';

type MockStatement = {
    sql: string;
    binds: unknown[];
    bind: (...values: unknown[]) => MockStatement;
    first: () => Promise<Record<string, unknown> | null>;
};

const createDb = (resolveFirst: (sql: string) => Record<string, unknown> | null) => {
    const statements: MockStatement[] = [];
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn((sql: string) => {
        const statement: MockStatement = {
            sql,
            binds: [],
            bind: (...values: unknown[]) => {
                statement.binds = values;
                return statement;
            },
            first: async () => resolveFirst(sql),
        };
        statements.push(statement);
        return statement;
    });
    return { DB: { prepare, batch }, statements, batch };
};

describe('settings entity write integrity', () => {
    it('スタッフ区分本体と勤務パターン関連付けを同じbatchで作成する', async () => {
        const db = createDb(sql => sql.includes('MAX(display_order)') ? { maxOrder: 2 } : null);
        const response = await createRole({
            request: { json: async () => ({ name: '常勤', targetHours: 160, patternIds: ['pattern-1', 'pattern-2'] }) },
            env: { DB: db.DB },
        } as never);
        const result = await response.json() as { id: string };

        expect(response.status).toBe(200);
        expect(result.id).toMatch(/^role_/);
        expect(db.batch).toHaveBeenCalledTimes(1);
        const batch = db.batch.mock.calls[0][0] as MockStatement[];
        expect(batch.map(statement => statement.sql)).toEqual([
            expect.stringContaining('INSERT INTO roles'),
            expect.stringContaining('INSERT INTO role_patterns'),
            expect.stringContaining('INSERT INTO role_patterns'),
        ]);
    });

    it('スタッフ区分本体と関連付けの更新を同じbatchへ積む', async () => {
        const db = createDb(sql => sql.includes('SELECT id FROM roles') ? { id: 'role-1' } : null);
        const response = await updateRole({
            params: { id: 'role-1' },
            request: { json: async () => ({ name: ' 常勤 ', patternIds: ['pattern-1'] }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(200);
        const batch = db.batch.mock.calls[0][0] as MockStatement[];
        expect(batch.map(statement => statement.sql)).toEqual([
            expect.stringContaining('UPDATE roles SET'),
            expect.stringContaining('DELETE FROM role_patterns'),
            expect.stringContaining('INSERT INTO role_patterns'),
        ]);
        expect(batch[0].binds).toEqual(['常勤', 'role-1']);
    });

    it('存在しないスタッフ区分の更新を404で返す', async () => {
        const db = createDb(() => null);
        const response = await updateRole({
            params: { id: 'missing' },
            request: { json: async () => ({ patternIds: [] }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(404);
        expect(db.batch).not.toHaveBeenCalled();
    });

    it('勤務時間パターン本体とスタッフ区分関連付けを同じbatchで作成する', async () => {
        const db = createDb(sql => sql.includes('MAX(display_order)') ? { maxOrder: 3 } : null);
        const response = await createTimePattern({
            request: { json: async () => ({ name: '早番', startTime: '08:00', endTime: '17:00', roleIds: ['role-1'] }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(200);
        const batch = db.batch.mock.calls[0][0] as MockStatement[];
        expect(batch.map(statement => statement.sql)).toEqual([
            expect.stringContaining('INSERT INTO shift_time_patterns'),
            expect.stringContaining('INSERT INTO role_patterns'),
        ]);
    });

    it('勤務時間パターン本体と関連付けの更新を同じbatchへ積む', async () => {
        const db = createDb(sql => sql.includes('SELECT id, startTime')
            ? { id: 'pattern-1', startTime: '08:00', endTime: '17:00' }
            : null);
        const response = await updateTimePattern({
            params: { id: 'pattern-1' },
            request: { json: async () => ({ endTime: '18:00', roleIds: ['role-1'] }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(200);
        const batch = db.batch.mock.calls[0][0] as MockStatement[];
        expect(batch.map(statement => statement.sql)).toEqual([
            expect.stringContaining('UPDATE shift_time_patterns SET'),
            expect.stringContaining('DELETE FROM role_patterns'),
            expect.stringContaining('INSERT INTO role_patterns'),
        ]);
    });

    it('勤務時間パターンの部分更新を既存時刻と組み合わせて検証する', async () => {
        const db = createDb(sql => sql.includes('SELECT id, startTime')
            ? { id: 'pattern-1', startTime: '08:00', endTime: '17:00' }
            : null);
        const response = await updateTimePattern({
            params: { id: 'pattern-1' },
            request: { json: async () => ({ endTime: '08:00' }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(400);
        expect(db.batch).not.toHaveBeenCalled();
    });
});
