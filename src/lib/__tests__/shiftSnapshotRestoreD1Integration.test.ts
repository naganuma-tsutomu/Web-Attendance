import { afterEach, describe, expect, it, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestPost as restoreSnapshot } from '../../../functions/api/shifts/snapshots/[id]/restore';

type SnapshotShift = {
    date: string;
    staffId: string;
    startTime: string;
    endTime: string;
    classType: string;
};

describe('shift snapshot restore with D1', () => {
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
                id TEXT PRIMARY KEY, date TEXT NOT NULL,
                staffId TEXT NOT NULL CHECK (staffId <> 'INVALID'),
                startTime TEXT NOT NULL, endTime TEXT NOT NULL, classType TEXT NOT NULL,
                isEarlyShift INTEGER DEFAULT 0, isError INTEGER DEFAULT 0,
                duty_number INTEGER DEFAULT NULL
            )`),
            db.prepare(`CREATE TABLE fixed_dates (
                date TEXT PRIMARY KEY, yearMonth TEXT NOT NULL
            )`),
            db.prepare(`CREATE TABLE shift_snapshots (
                id TEXT PRIMARY KEY, yearMonth TEXT NOT NULL, label TEXT,
                reason TEXT NOT NULL, shifts_json TEXT NOT NULL,
                fixed_dates_json TEXT NOT NULL DEFAULT '[]',
                shift_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )`),
        ]);
        return db;
    };

    const insertExistingData = async (db: D1Database) => {
        await db.batch([
            db.prepare(`INSERT INTO shifts
                (id, date, staffId, startTime, endTime, classType)
                VALUES ('existing', '2026-09-01', 'existing-staff', '09:00', '18:00', 'class-a')`),
            db.prepare(`INSERT INTO fixed_dates (date, yearMonth)
                VALUES ('2026-09-01', '2026-09')`),
        ]);
    };

    const insertSnapshot = async (
        db: D1Database,
        shifts: SnapshotShift[],
        fixedDates = ['2026-09-02'],
    ) => {
        await db.prepare(`INSERT INTO shift_snapshots
            (id, yearMonth, label, reason, shifts_json, fixed_dates_json, shift_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            'snapshot-target',
            '2026-09',
            '復元対象',
            'manual',
            JSON.stringify(shifts),
            JSON.stringify(fixedDates),
            shifts.length,
        ).run();
    };

    const restore = async (db: D1Database) => {
        const batch = vi.fn((statements: D1PreparedStatement[]) => db.batch(statements));
        const wrappedDb = {
            prepare: db.prepare.bind(db),
            batch,
        };
        const response = await restoreSnapshot({
            params: { id: 'snapshot-target' },
            request: new Request('https://example.com/api/shifts/snapshots/snapshot-target/restore', {
                method: 'POST',
            }),
            env: { DB: wrappedDb },
        } as never);
        return { batch, response };
    };

    it('250件の復元を最大6 statementの単一batchで完了する', async () => {
        const db = await createDatabase();
        await insertExistingData(db);
        const shifts = Array.from({ length: 250 }, (_, index) => ({
            date: `2026-09-${String((index % 28) + 1).padStart(2, '0')}`,
            staffId: `staff-${index}`,
            startTime: '09:00',
            endTime: '18:00',
            classType: 'class-a',
        }));
        await insertSnapshot(db, shifts, ['2026-09-02', '2026-09-03']);

        const { batch, response } = await restore(db);

        expect(response.status).toBe(200);
        expect(batch).toHaveBeenCalledTimes(1);
        expect(batch.mock.calls[0][0]).toHaveLength(6);
        await expect(response.json()).resolves.toMatchObject({
            restoredShiftCount: 250,
            restoredFixedDateCount: 2,
        });
        await expect(db.prepare('SELECT COUNT(*) AS count FROM shifts').first()).resolves.toMatchObject({ count: 250 });
        await expect(db.prepare('SELECT date FROM fixed_dates ORDER BY date').all()).resolves.toMatchObject({
            results: [{ date: '2026-09-02' }, { date: '2026-09-03' }],
        });
        const preRestore = await db.prepare(
            `SELECT shifts_json, fixed_dates_json FROM shift_snapshots WHERE reason = 'restore-before'`
        ).first<{ shifts_json: string; fixed_dates_json: string }>();
        expect(JSON.parse(preRestore!.shifts_json)).toEqual([expect.objectContaining({ staffId: 'existing-staff' })]);
        expect(JSON.parse(preRestore!.fixed_dates_json)).toEqual(['2026-09-01']);
    }, 15_000);

    it('復元データの挿入が失敗すると削除と自動バックアップ作成もロールバックする', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const db = await createDatabase();
        await insertExistingData(db);
        await insertSnapshot(db, [
            { date: '2026-09-02', staffId: 'restored-staff', startTime: '09:00', endTime: '18:00', classType: 'class-a' },
            { date: '2026-09-03', staffId: 'INVALID', startTime: '09:00', endTime: '18:00', classType: 'class-a' },
        ]);

        const { batch, response } = await restore(db);

        expect(response.status).toBe(500);
        expect(batch).toHaveBeenCalledTimes(1);
        await expect(db.prepare('SELECT id, staffId FROM shifts').all()).resolves.toMatchObject({
            results: [{ id: 'existing', staffId: 'existing-staff' }],
        });
        await expect(db.prepare('SELECT date FROM fixed_dates').all()).resolves.toMatchObject({
            results: [{ date: '2026-09-01' }],
        });
        await expect(db.prepare('SELECT id FROM shift_snapshots ORDER BY id').all()).resolves.toMatchObject({
            results: [{ id: 'snapshot-target' }],
        });
    }, 15_000);
});
