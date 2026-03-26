import { verifyCookie, verifyStaffCookie } from '../utils';
import type { Env } from '../types';

/**
 * API ミドルウェア: 認証 + CSRF 防御
 *
 * 認証レベル:
 *   1. 公開 (認証不要)           — /api/auth/*, /api/staffs/list (GET), /api/settings/classes (GET)
 *   2. スタッフ以上              — 読み取り系の限定エンドポイント (GET のみ)
 *   3. スタッフ本人の書き込み    — /api/preferences (POST) ※自分のstaffIdのみ
 *   4. 管理者のみ                — 上記以外すべて
 *
 * CSRF 防御:
 *   - 状態変更メソッド (POST/PUT/DELETE) は Content-Type: application/json を必須とする
 *   - ブラウザのフォーム送信やシンプルリクエストを遮断
 */
export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);
    const method = context.request.method;
    const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

    // ── 1. 認証ルート自体はバイパス ──
    if (url.pathname.startsWith('/api/auth/')) {
        return context.next();
    }

    // ── 2. CSRF 防御: 変更系メソッドは Content-Type: application/json を必須とする ──
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const contentType = context.request.headers.get('Content-Type') || '';
        if (!contentType.includes('application/json')) {
            return new Response(
                JSON.stringify({ error: 'Content-Type must be application/json' }),
                { status: 415, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }

    // ── 3. 公開エンドポイント (認証不要) ──
    const isPublicEndpoint =
        (url.pathname === '/api/staffs/list' && method === 'GET') ||
        (url.pathname === '/api/settings/classes' && method === 'GET');

    if (isPublicEndpoint) {
        return context.next();
    }

    // ── 4. 環境変数チェック ──
    if (!ADMIN_PASSWORD) {
        console.error('ADMIN_PASSWORD environment variable is not set');
        return new Response(
            JSON.stringify({ error: 'Internal Server Error: Missing Configuration' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // ── 5. Cookie からトークンを抽出 ──
    const cookieHeader = context.request.headers.get('Cookie') || '';

    const extractToken = (name: string): string | null => {
        const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
        return match ? match[1] : null;
    };

    // ── 6. 管理者認証 ──
    const adminToken = extractToken('auth_token');
    const isAdminAuthenticated = adminToken
        ? await verifyCookie(adminToken, ADMIN_PASSWORD)
        : false;

    if (isAdminAuthenticated) {
        return context.next();
    }

    // ── 7. スタッフ認証 ──
    const staffToken = extractToken('staff_token');
    const staffId = staffToken
        ? await verifyStaffCookie(staffToken, ADMIN_PASSWORD)
        : null;

    if (staffId) {
        // スタッフが GET できる読み取り専用エンドポイント
        const staffReadEndpoints = [
            '/api/preferences',
            '/api/shifts',
            '/api/staffs',
            '/api/settings/classes',
            '/api/settings/time-patterns',
            '/api/settings/roles',
            '/api/settings/holidays',
            '/api/fixed-dates',
        ];

        if (method === 'GET' && staffReadEndpoints.some(ep => url.pathname.startsWith(ep))) {
            return context.next();
        }

        // スタッフ本人の希望休書き込み (POST /api/preferences)
        if (url.pathname === '/api/preferences' && method === 'POST') {
            // リクエストボディを peek してスタッフ本人のデータかを確認
            try {
                const clonedRequest = context.request.clone();
                const body = await clonedRequest.json() as { staffId?: string };
                if (body.staffId === staffId) {
                    return context.next();
                }
                // 他人のデータを変更しようとしている
                return new Response(
                    JSON.stringify({ error: '自分の希望休のみ変更できます' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            } catch {
                return new Response(
                    JSON.stringify({ error: 'リクエストの解析に失敗しました' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }
    }

    // ── 8. 認証失敗 ──
    return new Response(
        JSON.stringify({ error: '認証が必要です。ログインしてください。' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
};
