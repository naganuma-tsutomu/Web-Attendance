import { STAFF_COOKIE_NAME } from '../../utils';
import type { Env } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const isSecure = context.request.url.startsWith('https');
    const cookie = `${STAFF_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${isSecure ? '; Secure' : ''}`;
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': cookie,
        },
    });
};
