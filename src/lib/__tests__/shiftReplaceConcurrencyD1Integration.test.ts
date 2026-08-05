import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestPost as replaceShifts } from '../../../functions/api/shifts/replace';

describe('monthly shift replacement concurrency with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    it('古いversionによる置換を409で拒否し、先に保存されたシフトを維持する', async () => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default { fetch() { return new Response("ok") } }',
            d1Databases: ['DB'],
        });
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare(`CREATE TABLE shifts (
                id TEXT PRIMARY KEY, date TEXT NOT NULL, staffId TEXT NOT NULL,
                startTime TEXT NOT NULL, endTime TEXT NOT NULL, classType TEXT NOT NULL,
                isEarlyShift INTEGER DEFAULT 0, isError INTEGER DEFAULT 0,
                duty_number INTEGER DEFAULT NULL
            )`),
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
            INSERT INTO shifts (id, date, staffId, startTime, endTime, classType)
            VALUES ('original', '2026-08-01', 's1', '09:00', '18:00', 'c1')
        `).run();

        const request = (staffId: string) => new Request('https://example.com/api/shifts/replace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                yearMonth: '2026-08',
                expectedVersion: 1,
                fixedDates: [],
                shifts: [{ date: '2026-08-02', staffId, startTime: '09:00', endTime: '18:00', classType: 'c1' }],
            }),
        });

        const first = await replaceShifts({ request: request('first'), env: { DB: db } } as never);
        const stale = await replaceShifts({ request: request('stale'), env: { DB: db } } as never);

        expect(first.status).toBe(200);
        expect(stale.status).toBe(409);
        await expect(db.prepare('SELECT staffId FROM shifts').all()).resolves.toMatchObject({
            results: [{ staffId: 'first' }],
        });
        await expect(db.prepare('SELECT lock_token FROM shift_month_versions WHERE year_month = ?').bind('2026-08').first())
            .resolves.toMatchObject({ lock_token: null });
    });
});
