import { handleServerError, createValidationError } from '../../utils/validation';
import { verifyAccessKey } from '../../utils';

export interface Env {
    DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { name, accessKey } = await context.request.json() as { name: string, accessKey: string };

        if (!name || !accessKey) {
            return createValidationError('名前とアクセスキーを入力してください');
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

        return Response.json({ id: staff.id, name: staff.name });
    } catch (e) {
        return handleServerError(e, 'Database error during staff login');
    }
};
