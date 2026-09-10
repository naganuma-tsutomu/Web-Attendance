import { afterEach, describe, expect, it, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestPost as replaceDayShifts } from '../../../functions/api/shifts/day';

describe('daily shift replacement with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        vi.restoreAllMocks();
        await miniflare?.dispose();
        miniflare = undefined;
    });

    const createDatabase = async () => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default { fetch() { return new Response("ok") } }',
            d1Databases: ['DB'],
        });
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare(`CREATE TABLE shifts (
                id TEXT PRIMARY KEY, date TEXT NOT NULL, staffId TEXT NOT NULL CHECK (staffId <> 'INVALID'),
                startTime TEXT NOT NULL, endTime TEXT NOT NULL, classType TEXT NOT NULL,
                isEarlyShift INTEGER DEFAULT 0, isError INTEGER DEFAULT 0,
                duty_number INTEGER DEFAULT NULL
            )`),
            db.prepare(`CREATE UNIQUE INDEX idx_shifts_date_class_duty_number
                ON shifts(date, classType, duty_number) WHERE duty_number IS NOT NULL`),
            db.prepare(`CREATE TABLE shift_month_versions (
                year_month TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, lock_token TEXT
            )`),
            db.prepare(`CREATE TRIGGER shifts_version_after_insert AFTER INSERT ON shifts BEGIN
                INSERT INTO shift_month_versions (year_month, version) VALUES (substr(NEW.date, 1, 7), 1)
                ON CONFLICT(year_month) DO UPDATE SET version = version + 1;
            END`),
            db.prepare(`CREATE TRIGGER shifts_version_after_delete AFTER DELETE ON shifts BEGIN
                INSERT INTO shift_month_versions (year_month, version) VALUES (substr(OLD.date, 1, 7), 1)
                ON CONFLICT(year_month) DO UPDATE SET version = version + 1;
            END`),
        ]);
        await db.prepare(`
            INSERT INTO shifts (id, date, staffId, startTime, endTime, classType, duty_number) VALUES
            ('keep', '2026-08-03', 's1', '09:00', '18:00', 'c1', 1),
            ('remove', '2026-08-03', 's2', '09:00', '18:00', 'c1', 2),
            ('other-day', '2026-08-04', 's3', '09:00', '18:00', 'c1', 1)
        `).run();
        return db;
    };

    const request = (expectedVersion: number, shifts: Record<string, unknown>[]) => new Request(
        'https://example.com/api/shifts/day',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: '2026-08-03', expectedVersion, shifts }),
        },
    );

    const versionOf = async (db: D1Database) => Number((await db.prepare(
        'SELECT version FROM shift_month_versions WHERE year_month = ?'
    ).bind('2026-08').first<{ version: number }>())?.version);

    it('削除・追加・更新を一度に保存し、対象外の日付を維持する', async () => {
        const db = await createDatabase();
        const version = await versionOf(db);
        const batch = vi.fn((statements: Parameters<typeof db.batch>[0]) => db.batch(statements));
        const wrappedDb = { prepare: db.prepare.bind(db), batch };
        const response = await replaceDayShifts({
            request: request(version, [
                { id: 'keep', date: '2026-08-03', staffId: 's1', startTime: '10:00', endTime: '17:00', classType: 'c2', duty_number: 1 },
                { date: '2026-08-03', staffId: 's4', startTime: '08:00', endTime: '12:00', classType: 'c1', duty_number: 1 },
            ]),
            env: { DB: wrappedDb },
        } as never);

        expect(response.status).toBe(200);
        expect(batch).toHaveBeenCalledTimes(1);
        expect(batch.mock.calls[0][0]).toHaveLength(5);
        await expect(db.prepare(
            'SELECT id, staffId, startTime, endTime, classType FROM shifts WHERE date = ? ORDER BY staffId'
        ).bind('2026-08-03').all()).resolves.toMatchObject({
            results: [
                { id: 'keep', staffId: 's1', startTime: '10:00', endTime: '17:00', classType: 'c2' },
                { id: expect.stringMatching(/^shift_/), staffId: 's4', startTime: '08:00', endTime: '12:00', classType: 'c1' },
            ],
        });
        await expect(db.prepare('SELECT staffId FROM shifts WHERE id = ?').bind('other-day').first())
            .resolves.toMatchObject({ staffId: 's3' });
    });

    it('挿入に失敗した場合は、先行する削除とロック取得もロールバックする', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const db = await createDatabase();
        const version = await versionOf(db);
        const response = await replaceDayShifts({
            request: request(version, [
                { id: 'keep', date: '2026-08-03', staffId: 's1', startTime: '10:00', endTime: '17:00', classType: 'c1' },
                { date: '2026-08-03', staffId: 'INVALID', startTime: '09:00', endTime: '18:00', classType: 'c2' },
            ]),
            env: { DB: db },
        } as never);

        expect(response.status).toBe(500);
        await expect(db.prepare(
            'SELECT id, staffId, startTime FROM shifts WHERE date = ? ORDER BY id'
        ).bind('2026-08-03').all()).resolves.toMatchObject({
            results: [
                { id: 'keep', staffId: 's1', startTime: '09:00' },
                { id: 'remove', staffId: 's2', startTime: '09:00' },
            ],
        });
        expect(await versionOf(db)).toBe(version);
        await expect(db.prepare(
            'SELECT lock_token FROM shift_month_versions WHERE year_month = ?'
        ).bind('2026-08').first()).resolves.toMatchObject({ lock_token: null });
    });

    it('古いversionの保存を409で拒否し、先に保存された内容を維持する', async () => {
        const db = await createDatabase();
        const staleVersion = await versionOf(db);
        const firstPayload = [
            { id: 'keep', date: '2026-08-03', staffId: 'first', startTime: '09:00', endTime: '18:00', classType: 'c1' },
        ];
        const stalePayload = [
            { id: 'keep', date: '2026-08-03', staffId: 'stale', startTime: '09:00', endTime: '18:00', classType: 'c1' },
        ];

        const first = await replaceDayShifts({ request: request(staleVersion, firstPayload), env: { DB: db } } as never);
        const stale = await replaceDayShifts({ request: request(staleVersion, stalePayload), env: { DB: db } } as never);

        expect(first.status).toBe(200);
        expect(stale.status).toBe(409);
        await expect(db.prepare('SELECT staffId FROM shifts WHERE id = ?').bind('keep').first())
            .resolves.toMatchObject({ staffId: 'first' });
    });
});
