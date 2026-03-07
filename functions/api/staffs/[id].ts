export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return new Response('Missing ID', { status: 400 });

        const staffData: any = await context.request.json();

        const statements = [
            context.env.DB.prepare(
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
                staffData.defaultWorkingHoursStart || null,
                staffData.defaultWorkingHoursEnd || null,
                id
            )
        ];

        if (staffData.availableDays) {
            // Re-sync available days: Delete old and insert new
            statements.push(context.env.DB.prepare("DELETE FROM staff_available_days WHERE staffId = ?").bind(id));

            staffData.availableDays.forEach((d: any, idx: number) => {
                const day = typeof d === 'number' ? d : d.day;
                const weeks = typeof d === 'number' ? null : (d.weeks ? JSON.stringify(d.weeks) : null);
                statements.push(
                    context.env.DB.prepare(
                        "INSERT INTO staff_available_days (id, staffId, dayOfWeek, weeks) VALUES (?, ?, ?, ?)"
                    ).bind(`${id}_available_${Date.now()}_${idx}`, id, day, weeks)
                );
            });
        }

        if (staffData.classIds) {
            // Re-sync staff classes: Delete old and insert new
            statements.push(context.env.DB.prepare("DELETE FROM staff_classes WHERE staffId = ?").bind(id));

            staffData.classIds.forEach((classId: string) => {
                statements.push(
                    context.env.DB.prepare(
                        "INSERT INTO staff_classes (staffId, classId) VALUES (?, ?)"
                    ).bind(id, classId)
                );
            });
        }

        await context.env.DB.batch(statements);

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
