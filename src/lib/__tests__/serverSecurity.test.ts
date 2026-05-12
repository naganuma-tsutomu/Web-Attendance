import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as getStaffs } from '../../../functions/api/staffs/index';
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
        expect(prepared[0].sql).toContain('date NOT IN');
        expect(prepared[0].binds).toEqual(['2025-06-01', '2025-07-01', '2025-06-10']);
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
