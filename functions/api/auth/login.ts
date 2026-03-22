import { signCookie } from '../../utils';

export interface Env {
    ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { password } = await context.request.json() as any;
        const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

        if (!ADMIN_PASSWORD) {
            return new Response('Server Configuration Error: ADMIN_PASSWORD not set', { status: 500 });
        }

        if (password !== ADMIN_PASSWORD) {
            return new Response('Unauthorized', { status: 401 });
        }

        const token = await signCookie(ADMIN_PASSWORD);
        const isSecure = context.request.url.startsWith('https');
        const cookie = `auth_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict${isSecure ? '; Secure' : ''}`;

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': cookie
            }
        });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
