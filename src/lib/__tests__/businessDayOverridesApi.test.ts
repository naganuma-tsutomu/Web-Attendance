import { describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../../../functions/api/settings/business-day-overrides/index';
import { onRequestDelete, onRequestPut } from '../../../functions/api/settings/business-day-overrides/[id]';
import { onRequestPost as bulkCreate } from '../../../functions/api/settings/business-day-overrides/bulk';

type Row = Record<string, unknown>;

const makeStatement = (options: {
    rows?: Row[];
    changes?: number;
    runError?: Error;
} = {}) => {
    const statement = {
        binds: [] as unknown[],
        bind: (...values: unknown[]) => {
            statement.binds = values;
            return statement;
        },
        all: async () => ({ results: options.rows ?? [] }),
        run: async () => {
            if (options.runError) throw options.runError;
            return { success: true, meta: { changes: options.changes ?? 1 } };
        },
    };
    return statement;
};

describe('business day overrides API', () => {
    it('指定月の一覧を境界日付きで取得する', async () => {
        const statement = makeStatement({ rows: [{ id: 'bdo-1', date: '2026-08-13', status: 'closed', name: '夏季休業' }] });
        const prepare = vi.fn(() => statement);

        const response = await onRequestGet({
            request: { url: 'https://example.com/api/settings/business-day-overrides?yearMonth=2026-08' },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(200);
        expect(statement.binds).toEqual(['2026-08-01', '2026-09-01']);
        await expect(response.json()).resolves.toEqual([{ id: 'bdo-1', date: '2026-08-13', status: 'closed', name: '夏季休業' }]);
    });

    it('年指定と不正な年月を検証する', async () => {
        const statement = makeStatement();
        const db = { prepare: vi.fn(() => statement) };
        const yearResponse = await onRequestGet({
            request: { url: 'https://example.com/api/settings/business-day-overrides?year=2026' }, env: { DB: db },
        } as never);
        expect(yearResponse.status).toBe(200);
        expect(statement.binds).toEqual(['2026-01-01', '2027-01-01']);

        const invalidResponse = await onRequestGet({
            request: { url: 'https://example.com/api/settings/business-day-overrides?yearMonth=2026-13' }, env: { DB: db },
        } as never);
        expect(invalidResponse.status).toBe(400);
    });

    it('名称をトリムして個別設定を作成する', async () => {
        const statement = makeStatement();
        const response = await onRequestPost({
            request: { json: async () => ({ date: '2026-08-13', status: 'closed', name: '  夏季休業  ' }) },
            env: { DB: { prepare: () => statement } },
        } as never);

        expect(response.status).toBe(201);
        expect(statement.binds.slice(1)).toEqual(['2026-08-13', 'closed', '夏季休業']);
        expect((await response.json() as { id: string }).id).toMatch(/^bdo_/);
    });

    it.each([
        [{ date: '2026-02-30', status: 'closed', name: '休業' }, '日付'],
        [{ date: '2026-08-13', status: 'invalid', name: '休業' }, '営業状態'],
        [{ date: '2026-08-13', status: 'closed', name: 123 }, '文字列'],
        [{ date: '2026-08-13', status: 'closed', name: 'あ'.repeat(101) }, '理由'],
    ])('不正な作成データを拒否する: %s', async (body, expectedMessage) => {
        const run = vi.fn();
        const response = await onRequestPost({
            request: { json: async () => body },
            env: { DB: { prepare: () => ({ bind: () => ({ run }) }) } },
        } as never);

        expect(response.status).toBe(400);
        expect(await response.text()).toContain(expectedMessage);
        expect(run).not.toHaveBeenCalled();
    });

    it('理由を入力せずに個別設定を作成できる', async () => {
        const statement = makeStatement();
        const response = await onRequestPost({
            request: { json: async () => ({ date: '2026-08-13', status: 'closed' }) },
            env: { DB: { prepare: () => statement } },
        } as never);

        expect(response.status).toBe(201);
        expect(statement.binds[3]).toBe('');
    });

    it('同じ日付の重複登録を400で返す', async () => {
        const statement = makeStatement({ runError: new Error('UNIQUE constraint failed: business_day_overrides.date') });
        const response = await onRequestPost({
            request: { json: async () => ({ date: '2026-08-13', status: 'closed', name: '夏季休業' }) },
            env: { DB: { prepare: () => statement } },
        } as never);

        expect(response.status).toBe(400);
        expect(await response.text()).toContain('既に個別設定があります');
    });

    it('営業状態と名称を更新する', async () => {
        const statement = makeStatement();
        const response = await onRequestPut({
            params: { id: 'bdo-1' },
            request: { json: async () => ({ status: 'open', name: '  祝日営業  ' }) },
            env: { DB: { prepare: () => statement } },
        } as never);

        expect(response.status).toBe(204);
        expect(statement.binds).toEqual(['open', '祝日営業', 'bdo-1']);
    });

    it('空更新を拒否し、存在しない更新を404で返す', async () => {
        const emptyResponse = await onRequestPut({
            params: { id: 'bdo-1' }, request: { json: async () => ({}) }, env: { DB: {} },
        } as never);
        expect(emptyResponse.status).toBe(400);

        const missingResponse = await onRequestPut({
            params: { id: 'missing' }, request: { json: async () => ({ status: 'closed' }) },
            env: { DB: { prepare: () => makeStatement({ changes: 0 }) } },
        } as never);
        expect(missingResponse.status).toBe(404);
    });

    it('個別設定を削除し、存在しない削除を404で返す', async () => {
        const existing = makeStatement();
        const deletedResponse = await onRequestDelete({
            params: { id: 'bdo-1' }, env: { DB: { prepare: () => existing } },
        } as never);
        expect(deletedResponse.status).toBe(204);
        expect(existing.binds).toEqual(['bdo-1']);

        const missingResponse = await onRequestDelete({
            params: { id: 'missing' }, env: { DB: { prepare: () => makeStatement({ changes: 0 }) } },
        } as never);
        expect(missingResponse.status).toBe(404);
    });

    it('期間内の日付を一括登録する', async () => {
        const prepared: ReturnType<typeof makeStatement>[] = [];
        const batch = vi.fn().mockResolvedValue([]);
        const db = {
            prepare: (sql: string) => {
                const statement = makeStatement({ rows: sql.startsWith('SELECT') ? [] : undefined });
                prepared.push(statement);
                return statement;
            },
            batch,
        };
        const response = await bulkCreate({
            request: { json: async () => ({ startDate: '2026-08-13', endDate: '2026-08-15', status: 'closed', name: '夏季休業' }) },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({ count: 3 });
        expect(batch).toHaveBeenCalledOnce();
        expect((batch.mock.calls[0][0] as typeof prepared)).toHaveLength(3);
        expect(prepared.slice(1).map(statement => statement.binds[1])).toEqual(['2026-08-13', '2026-08-14', '2026-08-15']);
    });

    it('期間内に既存設定があれば一括登録全体を409で停止する', async () => {
        const batch = vi.fn();
        const response = await bulkCreate({
            request: { json: async () => ({ startDate: '2026-08-13', endDate: '2026-08-15', status: 'closed', name: '夏季休業' }) },
            env: { DB: { prepare: () => makeStatement({ rows: [{ date: '2026-08-14' }] }), batch } },
        } as never);

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ dates: ['2026-08-14'] });
        expect(batch).not.toHaveBeenCalled();
    });

    it('終了日が開始日より前の一括登録を拒否する', async () => {
        const response = await bulkCreate({
            request: { json: async () => ({ startDate: '2026-08-15', endDate: '2026-08-13', status: 'closed', name: '夏季休業' }) },
            env: { DB: {} },
        } as never);
        expect(response.status).toBe(400);
    });

    it('31日を超える一括登録を拒否する', async () => {
        const response = await bulkCreate({
            request: { json: async () => ({ startDate: '2026-08-01', endDate: '2026-09-01', status: 'closed' }) },
            env: { DB: {} },
        } as never);
        expect(response.status).toBe(400);
        expect(await response.text()).toContain('31日以内');
    });
});
