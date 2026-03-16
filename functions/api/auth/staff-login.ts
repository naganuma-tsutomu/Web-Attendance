import { handleServerError } from '../../utils/validation';

export interface Env {
    DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { name, accessKey } = await context.request.json() as { name: string, accessKey: string };

        if (!name || !accessKey) {
            return new Response('名前とアクセスキーを入力してください', { status: 400 });
        }

        const staff = await context.env.DB.prepare(
            "SELECT id, name FROM staffs WHERE name = ? AND access_key = ?"
        ).bind(name.trim(), accessKey.trim()).first() as { id: string, name: string } | null;

        if (!staff) {
            return new Response('名前またはアクセスキーが正しくありません', { status: 401 });
        }

        return Response.json(staff);
    } catch (e) {
        return handleServerError(e, 'Database error during staff login');
    }
};
