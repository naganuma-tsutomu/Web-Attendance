import { verifyCookie, verifyStaffCookie } from '../utils';

export interface Env {
    ADMIN_PASSWORD?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);
    const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

    // 認証ルート自体はバイパス
    if (url.pathname.startsWith('/api/auth/')) {
        return context.next();
    }

    // 公開エンドポイント（スタッフログイン画面で認証前に必要）
    const isPublicEndpoint =
        url.pathname === '/api/staffs/list' ||
        (url.pathname === '/api/settings/classes' && context.request.method === 'GET');

    if (isPublicEndpoint) {
        return context.next();
    }

    if (!ADMIN_PASSWORD) {
        console.error('ADMIN_PASSWORD environment variable is not set');
        return new Response('Internal Server Error: Missing Configuration', { status: 500 });
    }

    const cookieHeader = context.request.headers.get('Cookie');

    // 管理者トークンを検証
    const isAdminAuthenticated = await (async () => {
        if (!cookieHeader?.includes('auth_token=')) return false;
        const match = cookieHeader.match(/auth_token=([^;]+)/);
        if (!match) return false;
        return verifyCookie(match[1], ADMIN_PASSWORD);
    })();

    if (isAdminAuthenticated) {
        return context.next();
    }

    // スタッフ専用エンドポイント（スタッフトークンでもアクセス可）
    const isStaffEndpoint =
        url.pathname === '/api/preferences' ||
        (url.pathname === '/api/shifts' && context.request.method === 'GET');

    if (isStaffEndpoint) {
        const staffId = await (async () => {
            if (!cookieHeader?.includes('staff_token=')) return null;
            const match = cookieHeader.match(/staff_token=([^;]+)/);
            if (!match) return null;
            return verifyStaffCookie(match[1], ADMIN_PASSWORD);
        })();

        if (staffId) {
            return context.next();
        }
    }

    return new Response('Unauthorized Access', { status: 401 });
};
