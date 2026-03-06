export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return new Response('Missing ID', { status: 400 });

        const staffData: any = await context.request.json();

        await context.env.DB.prepare(
            `UPDATE staffs SET 
                name = COALESCE(?, name),
                role = COALESCE(?, role),
                hoursTarget = COALESCE(?, hoursTarget),
                availableDays = COALESCE(?, availableDays),
                isHelpStaff = COALESCE(?, isHelpStaff),
                defaultWorkingHoursStart = COALESCE(?, defaultWorkingHoursStart),
                defaultWorkingHoursEnd = COALESCE(?, defaultWorkingHoursEnd)
             WHERE id = ?`
        ).bind(
            staffData.name || null,
            staffData.role || null,
            staffData.hoursTarget || null,
            staffData.availableDays ? JSON.stringify(staffData.availableDays) : null,
            staffData.isHelpStaff !== undefined ? (staffData.isHelpStaff ? 1 : 0) : null,
            staffData.defaultWorkingHours?.start || null,
            staffData.defaultWorkingHours?.end || null,
            id
        ).run();

        return new Response('Updated', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return new Response('Missing ID', { status: 400 });

        await context.env.DB.prepare("DELETE FROM staffs WHERE id = ?").bind(id).run();

        return new Response('Deleted', { status: 200 });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
