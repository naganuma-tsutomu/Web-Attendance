import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import {
    onRequestPatch as updateSubmission,
    onRequestPost as savePreference,
} from '../../../functions/api/preferences/index';

const migrationPath = resolve(process.cwd(), 'db/migrations/0008_shift_preferences_unique_staff_month.sql');
const readMigrationStatements = async () => (await readFile(migrationPath, 'utf8'))
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

describe('shift preference monthly uniqueness with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    const createDatabase = async (unique: boolean) => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default { fetch() { return new Response("ok") } }',
            d1Databases: ['DB'],
        });
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT NOT NULL)'),
            db.prepare(`CREATE TABLE shift_preferences (
                id TEXT PRIMARY KEY,
                staffId TEXT NOT NULL,
                yearMonth TEXT NOT NULL,
                submitted INTEGER DEFAULT 0,
                FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
            )`),
            db.prepare(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX idx_shift_preferences_staffid_ym
                ON shift_preferences(staffId, yearMonth)`),
            db.prepare(`CREATE TABLE shift_preference_dates (
                id TEXT PRIMARY KEY,
                staffId TEXT NOT NULL,
                yearMonth TEXT NOT NULL,
                date TEXT NOT NULL,
                startTime TEXT,
                endTime TEXT,
                type TEXT,
                FOREIGN KEY(staffId) REFERENCES staffs(id) ON DELETE CASCADE
            )`),
        ]);
        await db.prepare("INSERT INTO staffs VALUES ('s1', '職員1'), ('s2', '職員2')").run();
        return db;
    };

    const post = (db: D1Database, body: Record<string, unknown>) => savePreference({
        request: new Request('https://example.com/api/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        env: { DB: db },
    } as never);

    const patch = (db: D1Database, body: Record<string, unknown>) => updateSubmission({
        request: new Request('https://example.com/api/preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        env: { DB: db },
    } as never);

    it('既存重複を提出済み状態を失わず統合し、一意制約とCASCADEを維持する', async () => {
        const db = await createDatabase(false);
        await db.prepare(`INSERT INTO shift_preferences (id, staffId, yearMonth, submitted) VALUES
            ('p1', 's1', '2026-08', 0),
            ('p2', 's1', '2026-08', 1),
            ('p3', 's1', '2026-09', 0),
            ('p4', 's2', '2026-08', 0),
            ('p5', 's2', '2026-08', NULL)`).run();

        const migrationStatements = await readMigrationStatements();
        await db.batch(migrationStatements.map(statement => db.prepare(statement)));
        await db.batch(migrationStatements.map(statement => db.prepare(statement)));

        await expect(db.prepare(
            'SELECT id, staffId, yearMonth, submitted FROM shift_preferences ORDER BY id'
        ).all()).resolves.toMatchObject({ results: [
            { id: 'p1', staffId: 's1', yearMonth: '2026-08', submitted: 1 },
            { id: 'p3', staffId: 's1', yearMonth: '2026-09', submitted: 0 },
            { id: 'p4', staffId: 's2', yearMonth: '2026-08', submitted: 0 },
        ] });
        const index = await db.prepare(
            "SELECT sql FROM sqlite_schema WHERE type = 'index' AND name = 'idx_shift_preferences_staffid_ym'"
        ).first<{ sql: string }>();
        expect(index?.sql).toContain('CREATE UNIQUE INDEX');
        await expect(db.prepare(
            "INSERT INTO shift_preferences VALUES ('duplicate', 's1', '2026-08', 0)"
        ).run()).rejects.toThrow(/UNIQUE constraint failed/);

        await db.prepare("DELETE FROM staffs WHERE id = 's1'").run();
        await expect(db.prepare('SELECT id FROM shift_preferences ORDER BY id').all())
            .resolves.toMatchObject({ results: [{ id: 'p4' }] });
    }, 15_000);

    it('同じスタッフ・月への同時保存でも月次行と明細を一方の保存内容だけにする', async () => {
        const db = await createDatabase(true);
        const responses = await Promise.all([
            post(db, {
                staffId: 's1', yearMonth: '2026-08', submitted: false,
                details: [{ date: '2026-08-01' }],
            }),
            post(db, {
                staffId: 's1', yearMonth: '2026-08', submitted: true,
                details: [{ date: '2026-08-02' }],
            }),
        ]);

        expect(responses.map(response => response.status)).toEqual([200, 200]);
        const monthlyRows = await db.prepare(
            "SELECT submitted FROM shift_preferences WHERE staffId = 's1' AND yearMonth = '2026-08'"
        ).all<{ submitted: number }>();
        expect(monthlyRows.results).toHaveLength(1);
        expect([0, 1]).toContain(monthlyRows.results[0].submitted);
        const detailRows = await db.prepare(
            "SELECT date FROM shift_preference_dates WHERE staffId = 's1' AND yearMonth = '2026-08'"
        ).all<{ date: string }>();
        expect([['2026-08-01'], ['2026-08-02']]).toContainEqual(detailRows.results.map(row => row.date));
    });

    it('POSTでsubmittedを省略した場合は既存状態を維持し、明示時だけ更新する', async () => {
        const db = await createDatabase(true);
        await db.prepare(
            "INSERT INTO shift_preferences VALUES ('existing', 's1', '2026-08', 1)"
        ).run();

        expect((await post(db, { staffId: 's1', yearMonth: '2026-08', details: [] })).status).toBe(200);
        await expect(db.prepare("SELECT submitted FROM shift_preferences WHERE id = 'existing'").first())
            .resolves.toMatchObject({ submitted: 1 });

        expect((await post(db, {
            staffId: 's1', yearMonth: '2026-08', submitted: false, details: [],
        })).status).toBe(200);
        await expect(db.prepare("SELECT submitted FROM shift_preferences WHERE id = 'existing'").first())
            .resolves.toMatchObject({ submitted: 0 });
    });

    it('提出状態の同時PATCHでも月次行を1件だけ作成する', async () => {
        const db = await createDatabase(true);
        const responses = await Promise.all([
            patch(db, { staffId: 's2', yearMonth: '2026-08', submitted: false }),
            patch(db, { staffId: 's2', yearMonth: '2026-08', submitted: true }),
        ]);

        expect(responses.map(response => response.status)).toEqual([200, 200]);
        const monthlyRows = await db.prepare(
            "SELECT submitted FROM shift_preferences WHERE staffId = 's2' AND yearMonth = '2026-08'"
        ).all<{ submitted: number }>();
        expect(monthlyRows.results).toHaveLength(1);
        expect([0, 1]).toContain(monthlyRows.results[0].submitted);
    });
});
