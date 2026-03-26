import { handleServerError, createValidationError } from '../../utils/validation';
import { signStaffCookie } from '../../utils';
import type { Env } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { name, accessKey } = await context.request.json() as { name: string, accessKey: string };

        if (!name || !accessKey) {
            return createValidationError('名前とアクセスキーを入力してください');
        }

        const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
        if (!ADMIN_PASSWORD) {
            return handleServerError(new Error('Server Configuration Error'), 'Missing ADMIN_PASSWORD');
        }

        const staff = await context.env.DB.prepare(
            "SELECT id, name FROM staffs WHERE name = ? AND access_key = ?"
        ).bind(name.trim(), accessKey.trim()).first() as { id: string, name: string } | null;

        if (!staff) {
            return Response.json({ error: '名前またはアクセスキーが正しくありません' }, { status: 401 });
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
