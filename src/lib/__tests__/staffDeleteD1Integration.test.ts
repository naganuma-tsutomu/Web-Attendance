import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestDelete as deleteStaff } from '../../../functions/api/staffs/[id]';

describe('staff deletion with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it('スタッフ本体とそのシフトを削除し、他スタッフのシフトは維持する', async () => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default { fetch() { return new Response("ok") } }',
            d1Databases: ['DB'],
        });
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT NOT NULL)'),
            db.prepare('CREATE TABLE shifts (id TEXT PRIMARY KEY, staffId TEXT NOT NULL, date TEXT NOT NULL)'),
        ]);
        await db.batch([
            db.prepare("INSERT INTO staffs (id, name) VALUES ('s1', '削除対象'), ('s2', '維持対象')"),
            db.prepare("INSERT INTO shifts (id, staffId, date) VALUES ('shift1', 's1', '2026-08-01'), ('shift2', 's2', '2026-08-01')"),
        ]);

        const response = await deleteStaff({
            request: new Request('https://example.com/api/staffs/s1', { method: 'DELETE' }),
            env: { DB: db },
        } as never);

        expect(response.status).toBe(200);
        await expect(db.prepare('SELECT id FROM staffs ORDER BY id').all())
            .resolves.toMatchObject({ results: [{ id: 's2' }] });
        await expect(db.prepare('SELECT id, staffId FROM shifts ORDER BY id').all())
            .resolves.toMatchObject({ results: [{ id: 'shift2', staffId: 's2' }] });
        await expect(db.prepare(`
            SELECT COUNT(*) AS count
            FROM shifts LEFT JOIN staffs ON staffs.id = shifts.staffId
            WHERE staffs.id IS NULL
        `).first<{ count: number }>()).resolves.toMatchObject({ count: 0 });
    });
});
