import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestDelete as deleteClass } from '../../../functions/api/settings/classes/[id]';

describe('class deletion with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it('シフトで使用中のクラスを409で拒否し、未使用クラスだけ削除する', async () => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default { fetch() { return new Response("ok") } }',
            d1Databases: ['DB'],
        });
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare('CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL)'),
            db.prepare('CREATE TABLE shifts (id TEXT PRIMARY KEY, classType TEXT NOT NULL)'),
        ]);
        await db.batch([
            db.prepare("INSERT INTO classes (id, name) VALUES ('used', '使用中'), ('unused', '未使用')"),
            db.prepare("INSERT INTO shifts (id, classType) VALUES ('shift1', 'used')"),
        ]);

        const usedResponse = await deleteClass({ params: { id: 'used' }, env: { DB: db } } as never);
        const unusedResponse = await deleteClass({ params: { id: 'unused' }, env: { DB: db } } as never);
        const missingResponse = await deleteClass({ params: { id: 'missing' }, env: { DB: db } } as never);

        expect(usedResponse.status).toBe(409);
        expect(unusedResponse.status).toBe(200);
        expect(missingResponse.status).toBe(404);
        await expect(db.prepare('SELECT id FROM classes ORDER BY id').all())
            .resolves.toMatchObject({ results: [{ id: 'used' }] });
        await expect(db.prepare(`
            SELECT COUNT(*) AS count
            FROM shifts LEFT JOIN classes ON classes.id = shifts.classType
            WHERE classes.id IS NULL
        `).first<{ count: number }>()).resolves.toMatchObject({ count: 0 });
    });
});
