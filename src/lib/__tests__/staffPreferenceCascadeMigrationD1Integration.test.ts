import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';

const migrationPath = resolve(process.cwd(), 'db/migrations/0007_staff_preferences_on_delete_cascade.sql');
const readMigrationStatements = async () => (await readFile(migrationPath, 'utf8'))
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

describe('staff preference cascade migration with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it.each(['NO ACTION', 'CASCADE'] as const)(
        '%sの既存スキーマをCASCADEへ統一し、データとインデックスを維持する',
        async (currentAction) => {
            miniflare = new Miniflare({
                modules: true,
                script: 'export default { fetch() { return new Response("ok") } }',
                d1Databases: ['DB'],
            });
            const db = await miniflare.getD1Database('DB');
            const onDelete = currentAction === 'CASCADE' ? ' ON DELETE CASCADE' : '';
            await db.batch([
                db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT NOT NULL)'),
                db.prepare(`CREATE TABLE shift_preferences (
                    id TEXT PRIMARY KEY,
                    staffId TEXT NOT NULL,
                    yearMonth TEXT NOT NULL,
                    submitted INTEGER DEFAULT 0,
                    FOREIGN KEY(staffId) REFERENCES staffs(id)${onDelete}
                )`),
                db.prepare('CREATE INDEX idx_shift_preferences_staffid_ym ON shift_preferences(staffId, yearMonth)'),
            ]);
            await db.batch([
                db.prepare("INSERT INTO staffs VALUES ('s1', '削除対象'), ('s2', '維持対象')"),
                db.prepare("INSERT INTO shift_preferences VALUES ('p1', 's1', '2026-08', 1), ('p2', 's2', '2026-09', 0)"),
            ]);

            const migrationStatements = await readMigrationStatements();
            await db.batch(migrationStatements.map(statement => db.prepare(statement)));

            const table = await db.prepare(
                "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'shift_preferences'"
            ).first<{ sql: string }>();
            expect(table?.sql).toContain('ON DELETE CASCADE');
            await expect(db.prepare('SELECT id, staffId, yearMonth, submitted FROM shift_preferences ORDER BY id').all())
                .resolves.toMatchObject({ results: [
                    { id: 'p1', staffId: 's1', yearMonth: '2026-08', submitted: 1 },
                    { id: 'p2', staffId: 's2', yearMonth: '2026-09', submitted: 0 },
                ] });
            await expect(db.prepare(
                "SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'idx_shift_preferences_staffid_ym'"
            ).first()).resolves.toMatchObject({ name: 'idx_shift_preferences_staffid_ym' });
            await expect(db.prepare('PRAGMA foreign_key_check').all())
                .resolves.toMatchObject({ results: [] });

            await db.prepare("DELETE FROM staffs WHERE id = 's1'").run();
            await expect(db.prepare('SELECT id, staffId FROM shift_preferences').all())
                .resolves.toMatchObject({ results: [{ id: 'p2', staffId: 's2' }] });
        },
        15_000,
    );
});
