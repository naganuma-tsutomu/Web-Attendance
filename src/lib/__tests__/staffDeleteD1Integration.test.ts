import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestDelete as deleteStaff } from '../../../functions/api/staffs/[id]';

describe('staff deletion with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it.each(['NO ACTION', 'CASCADE'] as const)(
        'shift_preferencesが%sでも関連データを削除し、他スタッフのデータは維持する',
        async (preferenceDeleteAction) => {
            miniflare = new Miniflare({
                modules: true,
                script: 'export default { fetch() { return new Response("ok") } }',
                d1Databases: ['DB'],
            });
            const db = await miniflare.getD1Database('DB');
            await db.batch([
                db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT NOT NULL)'),
                db.prepare('CREATE TABLE shifts (id TEXT PRIMARY KEY, staffId TEXT NOT NULL, date TEXT NOT NULL)'),
                db.prepare(`CREATE TABLE staff_classes (
                    staffId TEXT NOT NULL, classId TEXT NOT NULL,
                    PRIMARY KEY (staffId, classId),
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
                )`),
                db.prepare(`CREATE TABLE staff_available_days (
                    id TEXT PRIMARY KEY, staffId TEXT NOT NULL,
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
                )`),
                db.prepare(`CREATE TABLE shift_preferences (
                    id TEXT PRIMARY KEY, staffId TEXT NOT NULL,
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE ${preferenceDeleteAction}
                )`),
                db.prepare(`CREATE TABLE shift_preference_dates (
                    id TEXT PRIMARY KEY, staffId TEXT NOT NULL,
                    FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
                )`),
            ]);
            await db.batch([
                db.prepare("INSERT INTO staffs (id, name) VALUES ('s1', '削除対象'), ('s2', '維持対象')"),
                db.prepare("INSERT INTO shifts (id, staffId, date) VALUES ('shift1', 's1', '2026-08-01'), ('shift2', 's2', '2026-08-01')"),
                db.prepare("INSERT INTO staff_classes (staffId, classId) VALUES ('s1', 'c1'), ('s2', 'c1')"),
                db.prepare("INSERT INTO staff_available_days (id, staffId) VALUES ('available1', 's1'), ('available2', 's2')"),
                db.prepare("INSERT INTO shift_preferences (id, staffId) VALUES ('preference1', 's1'), ('preference2', 's2')"),
                db.prepare("INSERT INTO shift_preference_dates (id, staffId) VALUES ('date1', 's1'), ('date2', 's2')"),
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
            for (const table of ['staff_classes', 'staff_available_days', 'shift_preferences', 'shift_preference_dates']) {
                await expect(db.prepare(`SELECT staffId FROM ${table} ORDER BY staffId`).all())
                    .resolves.toMatchObject({ results: [{ staffId: 's2' }] });
            }
        },
        15_000,
    );
});
