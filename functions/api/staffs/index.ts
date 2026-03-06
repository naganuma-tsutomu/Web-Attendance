import type { Staff } from '../../../src/types';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM staffs"
        ).all();

        // Parse JSON lists for availableDays
        const staffs = results.map((row: any) => ({
            ...row,
            availableDays: row.availableDays ? JSON.parse(row.availableDays) : undefined,
            isHelpStaff: row.isHelpStaff === 1,
            defaultWorkingHours: row.defaultWorkingHoursStart ? {
                start: row.defaultWorkingHoursStart,
                end: row.defaultWorkingHoursEnd
            } : undefined
        }));

        return Response.json(staffs);
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const staffData: Partial<Staff> = await context.request.json();

        // Generate simple ID if none
        const id = staffData.id || `staff_${Date.now()}`;

        await context.env.DB.prepare(
            `INSERT INTO staffs (id, name, role, hoursTarget, availableDays, isHelpStaff, defaultWorkingHoursStart, defaultWorkingHoursEnd)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            staffData.name || 'Unknown',
            staffData.role || 'パート',
            staffData.hoursTarget || null,
            staffData.availableDays ? JSON.stringify(staffData.availableDays) : null,
            staffData.isHelpStaff ? 1 : 0,
            staffData.defaultWorkingHours?.start || null,
            staffData.defaultWorkingHours?.end || null
        ).run();

        return Response.json({ id });
    } catch (e) {
        return new Response((e as Error).message, { status: 500 });
    }
};
