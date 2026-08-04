import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as getStaffs } from '../../../functions/api/staffs/index';
import { onRequestDelete as deleteStaff } from '../../../functions/api/staffs/[id]';
import { onRequestGet as getPreferences } from '../../../functions/api/preferences/index';
import { onRequestPost as replaceShifts } from '../../../functions/api/shifts/replace';
import { onRequest as middleware } from '../../../functions/api/_middleware';
import { signCookie, signStaffCookie, ADMIN_COOKIE_NAME, STAFF_COOKIE_NAME } from '../../../functions/utils';

const SECRET = 'test-secret';

type MockStatement = {
    sql: string;
    binds: unknown[];
    bind: (...values: unknown[]) => MockStatement;
    all: () => Promise<{ results: Record<string, unknown>[] }>;
    first: () => Promise<Record<string, unknown> | null>;
    run: () => Promise<{ success: boolean }>;
};

const createStatement = (
    sql: string,
    resolveRows: (sql: string, binds: unknown[]) => Record<string, unknown>[] = () => []
): MockStatement => {
    const statement: MockStatement = {
        sql,
        binds: [],
        bind: (...values: unknown[]) => {
            statement.binds = values;
            return statement;
        },
        all: async () => ({ results: resolveRows(sql, statement.binds) }),
        first: async () => resolveRows(sql, statement.binds)[0] ?? null,
        run: async () => ({ success: true }),
    };
    return statement;
};

const createContext = async (
    handler: 'staffs' | 'preferences' | 'replace',
    cookie: string,
    db: unknown,
    url = 'https://example.com/api/staffs',
    body?: unknown
) => ({
    request: {
        url,
        method: handler === 'replace' ? 'POST' : 'GET',
        headers: {
            get: (name: string) => {
                if (name.toLowerCase() === 'cookie') return cookie;
                if (name.toLowerCase() === 'content-type' && body) return 'application/json';
                return null;
            },
        },
        json: async () => body,
    },
    env: { DB: db, ADMIN_PASSWORD: SECRET },
});

describe('server API security boundaries', () => {
    it('スタッフ削除はシフトとスタッフ本体を同一batchで削除する', async () => {
        const batch = vi.fn().mockResolvedValue([]);
        const db = { prepare: (sql: string) => createStatement(sql), batch };

        const response = await deleteStaff({
            request: { url: 'https://example.com/api/staffs/s1' },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(200);
        expect(batch).toHaveBeenCalledTimes(1);
        const statements = batch.mock.calls[0][0] as MockStatement[];
        expect(statements.map(statement => statement.sql)).toEqual([
            'DELETE FROM shifts WHERE staffId = ?',
            'DELETE FROM staffs WHERE id = ?',
        ]);
        expect(statements.every(statement => statement.binds[0] === 's1')).toBe(true);
    });

    it('スタッフ権限のスタッフ一覧からアクセスキーを除外する', async () => {
        const staffToken = await signStaffCookie('s1', SECRET);
        const db = {
            prepare: (sql: string) => createStatement(sql, (query) => {
                if (query.startsWith('SELECT * FROM staffs')) {
                    return [
                        { id: 's1', name: '田中', role: 'パート', access_key: '123456', hoursTarget: 80 },
                        { id: 's2', name: '佐藤', role: 'パート', access_key: '654321', hoursTarget: 80 },
                    ];
                }
                return [];
            }),
        };

        const context = await createContext('staffs', `${STAFF_COOKIE_NAME}=${staffToken}`, db);
        const response = await getStaffs(context as never);
        const data = await response.json() as Array<Record<string, unknown>>;

        expect(data).toHaveLength(2);
        expect(data[0]).not.toHaveProperty('accessKey');
        expect(data[0]).not.toHaveProperty('access_key');
    });

    it('管理者権限のスタッフ一覧にはアクセスキーを残す', async () => {
        const adminToken = await signCookie(SECRET);
        const db = {
            prepare: (sql: string) => createStatement(sql, (query) => {
                if (query.startsWith('SELECT * FROM staffs')) {
                    return [{ id: 's1', name: '田中', role: 'パート', access_key: '123456' }];
                }
                return [];
            }),
        };

        const context = await createContext('staffs', `${ADMIN_COOKIE_NAME}=${adminToken}`, db);
        const response = await getStaffs(context as never);
        const data = await response.json() as Array<Record<string, unknown>>;

        expect(data[0].accessKey).toBe('123456');
    });

    it('スタッフ権限の希望休一覧を本人分に絞る', async () => {
        const staffToken = await signStaffCookie('s1', SECRET);
        const db = {
            prepare: (sql: string) => createStatement(sql, (query, binds) => {
                const staffFilter = binds[1];
                if (query.includes('shift_preferences')) {
                    return [
                        { id: 'p1', staffId: 's1', yearMonth: '2025-06', submitted: 1 },
                        { id: 'p2', staffId: 's2', yearMonth: '2025-06', submitted: 1 },
                    ].filter(row => !staffFilter || row.staffId === staffFilter);
                }
                if (query.includes('shift_preference_dates')) {
                    return [
                        { id: 'd1', staffId: 's1', yearMonth: '2025-06', date: '2025-06-01' },
                        { id: 'd2', staffId: 's2', yearMonth: '2025-06', date: '2025-06-02' },
                    ].filter(row => !staffFilter || row.staffId === staffFilter);
                }
                return [];
            }),
        };

        const context = await createContext(
            'preferences',
            `${STAFF_COOKIE_NAME}=${staffToken}`,
            db,
            'https://example.com/api/preferences?yearMonth=2025-06'
        );
        const response = await getPreferences(context as never);
        const data = await response.json() as Array<Record<string, unknown>>;

        expect(data.map(item => item.staffId)).toEqual(['s1']);
    });

    it('管理者権限の希望休一覧は全員分を返す', async () => {
        const adminToken = await signCookie(SECRET);
        const db = {
            prepare: (sql: string) => createStatement(sql, (query) => {
                if (query.includes('shift_preferences')) {
                    return [
                        { id: 'p1', staffId: 's1', yearMonth: '2025-06', submitted: 1 },
                        { id: 'p2', staffId: 's2', yearMonth: '2025-06', submitted: 1 },
                    ];
                }
                return [];
            }),
        };

        const context = await createContext(
            'preferences',
            `${ADMIN_COOKIE_NAME}=${adminToken}`,
            db,
            'https://example.com/api/preferences?yearMonth=2025-06'
        );
        const response = await getPreferences(context as never);
        const data = await response.json() as Array<Record<string, unknown>>;

        expect(data.map(item => item.staffId)).toEqual(['s1', 's2']);
    });

    it('月次シフト置換は固定日を除外した削除と挿入を同じbatchに積む', async () => {
        const batch = vi.fn().mockResolvedValue([]);
        const prepared: MockStatement[] = [];
        const db = {
            prepare: (sql: string) => {
                const statement = createStatement(sql);
                prepared.push(statement);
                return statement;
            },
            batch,
        };
        const context = await createContext(
            'replace',
            '',
            db,
            'https://example.com/api/shifts/replace',
            {
                yearMonth: '2025-06',
                fixedDates: ['2025-06-10'],
                shifts: [{ date: '2025-06-01', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'class_a' }],
            }
        );

        const response = await replaceShifts(context as never);

        expect(response.status).toBe(200);
        expect(batch).toHaveBeenCalledTimes(1);
        const deleteStatement = prepared.find(statement => statement.sql.startsWith('DELETE FROM shifts'));
        expect(deleteStatement?.sql).toContain('date NOT IN');
        expect(deleteStatement?.binds).toEqual(['2025-06-01', '2025-07-01', '2025-06-10']);
    });

    it('月次シフト置換は不正な挿入データなら削除batchを実行しない', async () => {
        const batch = vi.fn();
        const db = { prepare: (sql: string) => createStatement(sql), batch };
        const context = await createContext(
            'replace',
            '',
            db,
            'https://example.com/api/shifts/replace',
            {
                yearMonth: '2025-06',
                fixedDates: [],
                shifts: [{ date: '2025-07-01', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'class_a' }],
            }
        );

        const response = await replaceShifts(context as never);

        expect(response.status).toBe(400);
        expect(batch).not.toHaveBeenCalled();
    });

    it('月次シフト置換は当番番号重複なら削除batchを実行しない', async () => {
        const batch = vi.fn();
        const db = { prepare: (sql: string) => createStatement(sql), batch };
        const context = await createContext(
            'replace',
            '',
            db,
            'https://example.com/api/shifts/replace',
            {
                yearMonth: '2025-06',
                fixedDates: [],
                shifts: [
                    { date: '2025-06-01', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'class_a', duty_number: 1 },
                    { date: '2025-06-01', staffId: 's2', startTime: '09:00', endTime: '18:00', classType: 'class_a', duty_number: 1 },
                ],
            }
        );

        const response = await replaceShifts(context as never);

        expect(response.status).toBe(409);
        expect(batch).not.toHaveBeenCalled();
    });

    it('月次シフト置換は同一スタッフの時間重複なら削除batchを実行しない', async () => {
        const batch = vi.fn();
        const db = { prepare: (sql: string) => createStatement(sql), batch };
        const context = await createContext(
            'replace',
            '',
            db,
            'https://example.com/api/shifts/replace',
            {
                yearMonth: '2025-06',
                fixedDates: [],
                shifts: [
                    { date: '2025-06-02', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'class_a' },
                    { date: '2025-06-02', staffId: 's1', startTime: '10:00', endTime: '12:00', classType: 'class_b' },
                ],
            }
        );

        const response = await replaceShifts(context as never);

        expect(response.status).toBe(409);
        expect(batch).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            conflict: { date: '2025-06-02', staffId: 's1' },
        });
    });

    it('月次シフト置換は100件超でもDELETEと全INSERTを1回のbatchへ渡す', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const batch = vi.fn().mockRejectedValueOnce(new Error('atomic batch failed'));
        const db = {
            prepare: (sql: string) => createStatement(sql),
            batch,
        };
        const shifts = Array.from({ length: 100 }, (_, index) => ({
            date: '2025-06-03',
            staffId: `s${index}`,
            startTime: '09:00',
            endTime: '18:00',
            classType: 'class_a',
        }));
        const context = await createContext(
            'replace',
            '',
            db,
            'https://example.com/api/shifts/replace',
            { yearMonth: '2025-06', fixedDates: [], shifts }
        );

        const response = await replaceShifts(context as never);

        expect(response.status).toBe(500);
        expect(batch).toHaveBeenCalledTimes(1);
        const atomicBatch = batch.mock.calls[0][0] as MockStatement[];
        expect(atomicBatch).toHaveLength(101);
        expect(atomicBatch[0].sql).toContain('DELETE FROM shifts');
        expect(atomicBatch.slice(1).every(statement => statement.sql.includes('INSERT INTO shifts'))).toBe(true);
        consoleSpy.mockRestore();
    });
});

describe('middleware 経由の認可: POST /api/shifts/replace', () => {
    const replaceBody = {
        yearMonth: '2025-06',
        fixedDates: [],
        shifts: [],
    };

    const buildMiddlewareContext = async (cookie: string, adminPassword: string, contentType = 'application/json') => {
        const request = {
            url: 'https://example.com/api/shifts/replace',
            method: 'POST',
            headers: {
                get: (name: string) => {
                    const key = name.toLowerCase();
                    if (key === 'cookie') return cookie;
                    if (key === 'content-type') return contentType;
                    return null;
                },
            },
            clone: () => ({
                json: async () => replaceBody,
            }),
        };
        let nextCalled = false;
        const next = async () => {
            nextCalled = true;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        };
        const ctx = {
            request,
            env: { ADMIN_PASSWORD: adminPassword },
            next,
        };
        return { ctx, isNextCalled: () => nextCalled };
    };

    it('管理者トークンなら next() を呼ぶ', async () => {
        const adminToken = await signCookie(SECRET);
        const { ctx, isNextCalled } = await buildMiddlewareContext(`${ADMIN_COOKIE_NAME}=${adminToken}`, SECRET);
        const response = await middleware(ctx as never);
        expect(response.status).toBe(200);
        expect(isNextCalled()).toBe(true);
    });

    it('スタッフトークンなら 401 を返し next() を呼ばない', async () => {
        const staffToken = await signStaffCookie('s1', SECRET);
        const { ctx, isNextCalled } = await buildMiddlewareContext(`${STAFF_COOKIE_NAME}=${staffToken}`, SECRET);
        const response = await middleware(ctx as never);
        expect(response.status).toBe(401);
        expect(isNextCalled()).toBe(false);
    });

    it('Cookie なしなら 401 を返す', async () => {
        const { ctx, isNextCalled } = await buildMiddlewareContext('', SECRET);
        const response = await middleware(ctx as never);
        expect(response.status).toBe(401);
        expect(isNextCalled()).toBe(false);
    });

    it('Content-Type が application/json でなければ 415 を返す', async () => {
        const adminToken = await signCookie(SECRET);
        const { ctx, isNextCalled } = await buildMiddlewareContext(`${ADMIN_COOKIE_NAME}=${adminToken}`, SECRET, 'text/plain');
        const response = await middleware(ctx as never);
        expect(response.status).toBe(415);
        expect(isNextCalled()).toBe(false);
    });
});

describe('middleware 経由の認可: 個別営業日API', () => {
    const buildContext = async (method: 'GET' | 'POST') => {
        const staffToken = await signStaffCookie('s1', SECRET);
        let nextCalled = false;
        const context = {
            request: {
                url: 'https://example.com/api/settings/business-day-overrides?yearMonth=2026-08',
                method,
                headers: { get: (name: string) => name.toLowerCase() === 'cookie' ? `${STAFF_COOKIE_NAME}=${staffToken}` : name.toLowerCase() === 'content-type' ? 'application/json' : null },
                clone: () => ({ json: async () => ({ date: '2026-08-13', status: 'closed', name: '夏季休業' }) }),
            },
            env: { ADMIN_PASSWORD: SECRET },
            next: async () => {
                nextCalled = true;
                return new Response(null, { status: 204 });
            },
        };
        return { context, wasNextCalled: () => nextCalled };
    };

    it('スタッフのGETを許可する', async () => {
        const { context, wasNextCalled } = await buildContext('GET');
        const response = await middleware(context as never);
        expect(response.status).toBe(204);
        expect(wasNextCalled()).toBe(true);
    });

    it('スタッフのPOSTを拒否する', async () => {
        const { context, wasNextCalled } = await buildContext('POST');
        const response = await middleware(context as never);
        expect(response.status).toBe(401);
        expect(wasNextCalled()).toBe(false);
    });
});
