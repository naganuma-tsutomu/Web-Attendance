import { signCookie, TOKEN_MAX_AGE_SECONDS, ADMIN_COOKIE_NAME } from '../../utils';
import type { Env } from '../../types';

/**
 * HMAC-SHA256 を使った定数時間パスワード比較
 * - 両者を同一の固定キーで HMAC 化してバイト長を揃える
 * - XOR 累積を使って定数時間で比較し、タイミング攻撃を防ぐ
 */
async function timingSafePasswordCheck(input: string, expected: string): Promise<boolean> {
    const encoder = new TextEncoder();
    // 固定ゼロキー（32 バイト）で HMAC-SHA256 を生成し、出力長を統一する
    const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(32),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const [inputHash, expectedHash] = await Promise.all([
        crypto.subtle.sign('HMAC', key, encoder.encode(input)),
        crypto.subtle.sign('HMAC', key, encoder.encode(expected)),
    ]);
    const a = new Uint8Array(inputHash);
    const b = new Uint8Array(expectedHash);
    // 両ハッシュは必ず同じ長さ (32 bytes) なので length 差による漏洩もない
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a[i] ^ b[i];
    }
    return mismatch === 0;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { password } = await context.request.json() as { password?: string };
        const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

        if (!ADMIN_PASSWORD) {
            return new Response(
                JSON.stringify({ error: 'Server Configuration Error: ADMIN_PASSWORD not set' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 定数時間比較（タイミング攻撃対策）
        const isValid = typeof password === 'string' && await timingSafePasswordCheck(password, ADMIN_PASSWORD);
        if (!isValid) {
            return new Response(
                JSON.stringify({ error: '認証に失敗しました' }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const token = await signCookie(ADMIN_PASSWORD);
        const isSecure = context.request.url.startsWith('https');
        const cookie = `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Strict${isSecure ? '; Secure' : ''}`;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookie
            }
        });
    } catch (e) {
        return new Response(
            JSON.stringify({ error: (e as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
