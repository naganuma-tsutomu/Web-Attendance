import { verifyCookie } from '../utils';

export interface Env {
    ADMIN_PASSWORD?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);

    // Bypass auth routes
    if (url.pathname.startsWith('/api/auth/')) {
        return context.next();
    }

    // Allow staff-related endpoints (minimal protection for now)
    const isStaffEndpoint = 
        url.pathname === '/api/preferences' ||
        url.pathname === '/api/staffs/list' ||
        (url.pathname === '/api/staffs' && context.request.method === 'GET') ||
        (url.pathname === '/api/shifts' && context.request.method === 'GET') ||
        (url.pathname === '/api/settings/classes' && context.request.method === 'GET');

    if (isStaffEndpoint) {
        return context.next();
    }

    const cookieHeader = context.request.headers.get('Cookie');
    const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
        console.error('ADMIN_PASSWORD environment variable is not set');
        return new Response('Internal Server Error: Missing Configuration', { status: 500 });
    }

    let isAuthenticated = false;
    if (cookieHeader && cookieHeader.includes('auth_token=')) {
        const match = cookieHeader.match(/auth_token=([^;]+)/);
        if (match) {
            isAuthenticated = await verifyCookie(match[1], ADMIN_PASSWORD);
        }
    }

    if (!isAuthenticated) {
        return new Response('Unauthorized Access', { status: 401 });
    }

    return context.next();
};
