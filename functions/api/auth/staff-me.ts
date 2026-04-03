import { verifyStaffCookie, STAFF_COOKIE_NAME } from '../../utils';
import type { Env } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
        return Response.json({ authenticated: false, error: 'Server Configuration Error' }, { status: 500 });
    }

    const cookieHeader = context.request.headers.get('Cookie') || '';
    const match = cookieHeader.match(new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`));
    if (!match) {
        return Response.json({ authenticated: false }, { status: 401 });
    }

    const staffId = await verifyStaffCookie(match[1], ADMIN_PASSWORD);
    if (!staffId) {
        return Response.json({ authenticated: false }, { status: 401 });
    }

    const staff = await context.env.DB.prepare(
        'SELECT id, name FROM staffs WHERE id = ?'
    ).bind(staffId).first() as { id: string; name: string } | null;

    if (!staff) {
        return Response.json({ authenticated: false }, { status: 401 });
    }

    return Response.json({ authenticated: true, staff: { id: staff.id, name: staff.name } });
};
