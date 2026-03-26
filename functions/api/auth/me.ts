import { verifyCookie, ADMIN_COOKIE_NAME } from '../../utils';
import type { Env } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const cookieHeader = context.request.headers.get('Cookie');
    const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
        return Response.json({ authenticated: false, error: 'Server Configuration Error' }, { status: 500 });
    }

    if (cookieHeader && cookieHeader.includes(`${ADMIN_COOKIE_NAME}=`)) {
        const match = cookieHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
        if (match) {
            const isValid = await verifyCookie(match[1], ADMIN_PASSWORD);
            if (isValid) {
                return Response.json({ authenticated: true, user: { uid: 'admin', email: 'admin' } });
            }
        }
    }

    return Response.json({ authenticated: false }, { status: 401 });
};
