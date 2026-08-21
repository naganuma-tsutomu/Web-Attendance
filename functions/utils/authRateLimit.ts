const MAX_FAILURES = 10;
const WINDOW_SECONDS = 10 * 60;
const BLOCK_SECONDS = 15 * 60;
const RETENTION_SECONDS = 7 * 24 * 60 * 60;

const sha256 = async (value: string): Promise<string> => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
};

const clientIp = (request: Request): string =>
    request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';

export const buildAuthRateLimitKeys = async (
    request: Request,
    scope: 'admin' | 'staff',
    identity?: string,
): Promise<string[]> => {
    const rawKeys = [`${scope}:ip:${clientIp(request)}`];
    if (identity?.trim()) rawKeys.push(`${scope}:identity:${identity.trim().toLocaleLowerCase('ja-JP')}`);
    return Promise.all(rawKeys.map(sha256));
};

export const checkAuthRateLimit = async (
    db: D1Database,
    keys: string[],
    nowSeconds = Math.floor(Date.now() / 1000),
): Promise<number> => {
    const placeholders = keys.map(() => '?').join(',');
    const row = await db.prepare(
        `SELECT MAX(blocked_until) AS blocked_until
         FROM auth_rate_limits WHERE key_hash IN (${placeholders})`
    ).bind(...keys).first<{ blocked_until: number | null }>();
    return Math.max(0, Number(row?.blocked_until ?? 0) - nowSeconds);
};

export const recordAuthFailure = async (
    db: D1Database,
    keys: string[],
    nowSeconds = Math.floor(Date.now() / 1000),
): Promise<number> => {
    const cutoff = nowSeconds - WINDOW_SECONDS;
    const blockedUntil = nowSeconds + BLOCK_SECONDS;
    const statement = db.prepare(
        `INSERT INTO auth_rate_limits (key_hash, attempts, window_started_at, blocked_until, updated_at)
         VALUES (?, 1, ?, 0, ?)
         ON CONFLICT(key_hash) DO UPDATE SET
             blocked_until = CASE
                 WHEN window_started_at <= ? THEN 0
                 WHEN attempts + 1 >= ? THEN ?
                 ELSE blocked_until
             END,
             attempts = CASE WHEN window_started_at <= ? THEN 1 ELSE attempts + 1 END,
             window_started_at = CASE WHEN window_started_at <= ? THEN ? ELSE window_started_at END,
             updated_at = ?`
    );
    await db.batch([
        db.prepare('DELETE FROM auth_rate_limits WHERE updated_at < ?').bind(nowSeconds - RETENTION_SECONDS),
        ...keys.map(key => statement.bind(
            key, nowSeconds, nowSeconds,
            cutoff, MAX_FAILURES, blockedUntil,
            cutoff, cutoff, nowSeconds, nowSeconds,
        )),
    ]);
    return checkAuthRateLimit(db, keys, nowSeconds);
};

export const clearAuthFailures = async (db: D1Database, keys: string[]): Promise<void> => {
    const placeholders = keys.map(() => '?').join(',');
    await db.prepare(`DELETE FROM auth_rate_limits WHERE key_hash IN (${placeholders})`).bind(...keys).run();
};

export const createRateLimitResponse = (retryAfter: number): Response => new Response(
    JSON.stringify({ error: 'ログイン試行回数が上限に達しました。時間をおいて再度お試しください' }),
    {
        status: 429,
        headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.max(1, retryAfter)),
        },
    },
);
