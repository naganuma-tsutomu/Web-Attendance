import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { onRequestPost as adminLogin } from '../../../functions/api/auth/login';
import { onRequestPost as staffLogin } from '../../../functions/api/auth/staff-login';

const ADMIN_PASSWORD = 'correct-admin-password';

describe('authentication rate limiting with D1', () => {
    let miniflare: Miniflare | undefined;

    afterEach(async () => {
        await miniflare?.dispose();
        miniflare = undefined;
    });

    const request = (path: string, ip: string, body: unknown) => new Request(`https://example.com${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify(body),
    });

    it('管理者はIP単位、スタッフはIPと氏名単位で10回目から429にする', async () => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default { fetch() { return new Response("ok") } }',
            d1Databases: ['DB'],
        });
        const db = await miniflare.getD1Database('DB');
        await db.batch([
            db.prepare(`CREATE TABLE auth_rate_limits (
                key_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,
                window_started_at INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            )`),
            db.prepare('CREATE TABLE staffs (id TEXT PRIMARY KEY, name TEXT NOT NULL, access_key TEXT)'),
            db.prepare("INSERT INTO staffs (id, name, access_key) VALUES ('s1', '山田', '123456')"),
        ]);

        for (let attempt = 1; attempt <= 10; attempt += 1) {
            const response = await adminLogin({
                request: request('/api/auth/login', '192.0.2.1', { password: 'wrong' }),
                env: { DB: db, ADMIN_PASSWORD },
            } as never);
            expect(response.status).toBe(attempt < 10 ? 401 : 429);
        }
        const blockedAdmin = await adminLogin({
            request: request('/api/auth/login', '192.0.2.1', { password: ADMIN_PASSWORD }),
            env: { DB: db, ADMIN_PASSWORD },
        } as never);
        expect(blockedAdmin.status).toBe(429);

        for (let attempt = 1; attempt <= 10; attempt += 1) {
            const response = await staffLogin({
                request: request('/api/auth/staff-login', `198.51.100.${attempt}`, { name: '山田', accessKey: '000000' }),
                env: { DB: db, ADMIN_PASSWORD },
            } as never);
            expect(response.status).toBe(attempt < 10 ? 401 : 429);
        }
        const blockedStaff = await staffLogin({
            request: request('/api/auth/staff-login', '203.0.113.1', { name: '山田', accessKey: '123456' }),
            env: { DB: db, ADMIN_PASSWORD },
        } as never);
        expect(blockedStaff.status).toBe(429);
        expect(blockedStaff.headers.get('Retry-After')).toMatch(/^\d+$/);
    }, 15_000);
});
