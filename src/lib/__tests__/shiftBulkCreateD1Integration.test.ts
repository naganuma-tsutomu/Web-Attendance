import { afterEach, describe, expect, it, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestPost as createShifts } from '../../../functions/api/shifts/index';

describe('bulk shift creation with D1', () => {
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
        ]);
        return db;
    };

    const shifts = (count: number) => Array.from({ length: count }, (_, index) => ({
        date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
        staffId: `staff-${index}`,
        startTime: '09:00',
        endTime: '18:00',
        classType: 'class-a',
    }));

    const execute = async (db: D1Database, body: Record<string, unknown>[]) => {
        const preparedSql: string[] = [];
        const wrappedDb = {
            prepare: (sql: string) => {
                preparedSql.push(sql);
                return db.prepare(sql);
            },
            batch: db.batch.bind(db),
        };
        const response = await createShifts({
            request: { json: async () => body },
            env: { DB: wrappedDb },
        } as never);
        return { preparedSql, response };
    };

    it('上限1000件を1回の既存確認SELECTと1回のINSERTで保存する', async () => {
        const db = await createDatabase();
        const { preparedSql, response } = await execute(db, shifts(1000));

        expect(response.status).toBe(200);
        expect(preparedSql.filter(sql => sql.includes('WITH requested_keys'))).toHaveLength(1);
        expect(preparedSql.filter(sql => sql.includes('INSERT INTO shifts'))).toHaveLength(1);
        expect(preparedSql.every(sql => sql.includes('json_each(?)'))).toBe(true);
        await expect(db.prepare('SELECT COUNT(*) AS count FROM shifts').first())
            .resolves.toMatchObject({ count: 1000 });
    }, 15_000);

    it('途中の行がDB制約に違反しても1件も追加しない', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const db = await createDatabase();
        const input = shifts(250);
        input[149].staffId = 'INVALID';

        const { response } = await execute(db, input);

        expect(response.status).toBe(500);
        await expect(db.prepare('SELECT COUNT(*) AS count FROM shifts').first())
            .resolves.toMatchObject({ count: 0 });
    });

    it('既存シフトとの重複を集約SELECTで検出して追加しない', async () => {
        const db = await createDatabase();
        await db.prepare(`
            INSERT INTO shifts (id, date, staffId, startTime, endTime, classType)
            VALUES ('existing', '2026-08-03', 'staff-1', '09:00', '12:00', 'class-a')
        `).run();

        const { preparedSql, response } = await execute(db, [{
            date: '2026-08-03',
            staffId: 'staff-1',
            startTime: '11:00',
            endTime: '15:00',
            classType: 'class-b',
        }]);

        expect(response.status).toBe(409);
        expect(preparedSql.filter(sql => sql.includes('WITH requested_keys'))).toHaveLength(1);
        expect(preparedSql.some(sql => sql.includes('INSERT INTO shifts'))).toBe(false);
        await expect(db.prepare('SELECT COUNT(*) AS count FROM shifts').first())
            .resolves.toMatchObject({ count: 1 });
    });
});
