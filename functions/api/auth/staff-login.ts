import { handleServerError, createValidationError, validateAccessKey } from '../../utils/validation';
import { signStaffCookie, TOKEN_MAX_AGE_SECONDS, STAFF_COOKIE_NAME } from '../../utils';
import type { Env } from '../../types';
import { StaffLoginSchema } from '../../../shared/basicRequestSchemas';
import {
    buildAuthRateLimitKeys, checkAuthRateLimit, clearAuthFailures,
    createRateLimitResponse, recordAuthFailure,
} from '../../utils/authRateLimit';

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const parsed = StaffLoginSchema.safeParse(await context.request.json());
        if (!parsed.success) return createValidationError('名前とアクセスキーを正しく入力してください');
        const { name, accessKey } = parsed.data;
        const accessKeyError = validateAccessKey(accessKey.trim());
        if (accessKeyError) return createValidationError(accessKeyError);

        const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
        if (!ADMIN_PASSWORD) {
            return handleServerError(new Error('Server Configuration Error'), 'Missing ADMIN_PASSWORD');
        }

        const rateLimitKeys = await buildAuthRateLimitKeys(context.request, 'staff', name);
        const retryAfter = await checkAuthRateLimit(context.env.DB, rateLimitKeys);
        if (retryAfter > 0) return createRateLimitResponse(retryAfter);

        const staff = await context.env.DB.prepare(
            "SELECT id, name FROM staffs WHERE name = ? AND access_key = ?"
        ).bind(name.trim(), accessKey.trim()).first() as { id: string, name: string } | null;

        if (!staff) {
            const retry = await recordAuthFailure(context.env.DB, rateLimitKeys);
            if (retry > 0) return createRateLimitResponse(retry);
            return Response.json({ error: 'アクセスキーが正しくありません' }, { status: 401 });
        }

        await clearAuthFailures(context.env.DB, rateLimitKeys);

        const token = await signStaffCookie(staff.id, ADMIN_PASSWORD);
        const isSecure = context.request.url.startsWith('https');
        const cookie = `${STAFF_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Strict${isSecure ? '; Secure' : ''}`;

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
