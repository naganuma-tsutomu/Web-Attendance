import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as getAuditLogs } from '../../../functions/api/audit-logs/index';

const auditRow = (id: string, occurredAt = '2026-09-09 12:00:00') => ({
    id,
    occurred_at: occurredAt,
    actor_type: 'admin',
    actor_id: null,
    action: 'update',
    entity_type: 'shift',
    entity_id: null,
    year_month: '2026-09',
    target_date: null,
    summary: id,
    before_json: null,
    after_json: '{broken',
    metadata_json: null,
    request_id: null,
});

const createDb = (rows: Array<Record<string, unknown>>) => {
    const all = vi.fn().mockResolvedValue({ results: rows });
    const bind = vi.fn(() => ({ all }));
    const prepare = vi.fn((sql: string) => ({ sql, bind }));
    return { DB: { prepare }, prepare, bind };
};

describe('audit log API', () => {
    it('同一時刻のログを欠落させない複合カーソルを返す', async () => {
        const db = createDb([auditRow('audit-c'), auditRow('audit-b'), auditRow('audit-a')]);
        const response = await getAuditLogs({
            request: { url: 'https://example.com/api/audit-logs?yearMonth=2026-09&limit=2' },
            env: { DB: db.DB },
        } as never);
        const result = await response.json() as {
            items: Array<{ id: string; after: unknown }>;
            nextCursor: string | null;
        };

        expect(response.status).toBe(200);
        expect(result.items.map(item => item.id)).toEqual(['audit-c', 'audit-b']);
        expect(result.items[0].after).toBeNull();
        expect(JSON.parse(result.nextCursor!)).toEqual(['2026-09-09 12:00:00', 'audit-b']);
    });

    it('複合カーソルの時刻とIDを次ページ条件へ渡す', async () => {
        const db = createDb([]);
        const cursor = JSON.stringify(['2026-09-09 12:00:00', 'audit-b']);
        const response = await getAuditLogs({
            request: { url: `https://example.com/api/audit-logs?cursor=${encodeURIComponent(cursor)}&limit=25` },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(200);
        expect(db.prepare.mock.calls[0][0]).toContain('occurred_at = ? AND id < ?');
        expect(db.bind).toHaveBeenCalledWith(
            '2026-09-09 12:00:00',
            '2026-09-09 12:00:00',
            'audit-b',
            26,
        );
    });

    it.each([
        'not-json',
        JSON.stringify(['2026-09-09 12:00:00']),
        JSON.stringify(['2026-09-09 12:00:00', '']),
    ])('不正なカーソルをDB処理前に拒否する', async cursor => {
        const db = createDb([]);
        const response = await getAuditLogs({
            request: { url: `https://example.com/api/audit-logs?cursor=${encodeURIComponent(cursor)}` },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(400);
        expect(db.prepare).not.toHaveBeenCalled();
    });

    it.each(['0', '101', '1.5', 'abc', ''])('不正な取得件数をDB処理前に拒否する: %s', async limit => {
        const db = createDb([]);
        const response = await getAuditLogs({
            request: { url: `https://example.com/api/audit-logs?limit=${limit}` },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(400);
        expect(db.prepare).not.toHaveBeenCalled();
    });
});
