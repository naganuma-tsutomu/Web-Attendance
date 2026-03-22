import { handleServerError, createValidationError } from '../../utils/validation';
import { verifyAccessKey, signStaffCookie } from '../../utils';

export interface Env {
    DB: D1Database;
    ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { name, accessKey } = await context.request.json() as { name: string, accessKey: string };

        if (!name || !accessKey) {
            return createValidationError('名前とアクセスキーを入力してください');
        }

        const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
        if (!ADMIN_PASSWORD) {
            return new Response('Server Configuration Error', { status: 500 });
        }

        const staff = await context.env.DB.prepare(
            "SELECT id, name, access_key FROM staffs WHERE name = ?"
        ).bind(name.trim()).first() as { id: string, name: string, access_key: string | null } | null;

        // 存在しない場合でも同じメッセージを返す（ユーザー列挙攻撃の防止）
        if (!staff || !staff.access_key) {
            return new Response('名前またはアクセスキーが正しくありません', { status: 401 });
        }

        const isValid = await verifyAccessKey(accessKey.trim(), staff.access_key);
        if (!isValid) {
            return new Response('名前またはアクセスキーが正しくありません', { status: 401 });
        }

        const token = await signStaffCookie(staff.id, ADMIN_PASSWORD);
        const isSecure = context.request.url.startsWith('https');
        const cookie = `staff_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict${isSecure ? '; Secure' : ''}`;

        return new Response(JSON.stringify({ id: staff.id, name: staff.name }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookie,
            },
        });
    } catch (e) {
        return handleServerError(e, 'Database error during staff login');
    }
};
