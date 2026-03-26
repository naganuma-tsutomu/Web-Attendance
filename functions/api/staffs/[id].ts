import { handleServerError, createValidationError, validateName, validateRole } from '../../utils/validation';
import type { Env, D1Row, D1BindParam } from '../../types';

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return createValidationError('IDが指定されていません');

        const staffData = await context.request.json() as Partial<{
            name: string; role: string; hoursTarget: number | null;
            weeklyHoursTarget: number | null; isHelpStaff: boolean;
            defaultWorkingHoursStart: string | null; defaultWorkingHoursEnd: string | null;
            accessKey: string | null;
            availableDays: (number | { day: number; weeks?: number[] | null })[];
            classIds: string[];
        }>;
        
        // Validate name if provided
        if (staffData.name !== undefined) {
            const nameError = validateName(staffData.name, '名前', 100);
            if (nameError) return createValidationError(nameError);
        }
        
        // Validate role if provided
        if (staffData.role !== undefined) {
            const roleError = validateRole(staffData.role);
            if (roleError) return createValidationError(roleError);
        }

        const statements = [
            context.env.DB.prepare(
                `UPDATE staffs SET
                    name = COALESCE(?, name),
                    role = COALESCE(?, role),
                    hoursTarget = COALESCE(?, hoursTarget),
                    weeklyHoursTarget = COALESCE(?, weeklyHoursTarget),
                    isHelpStaff = COALESCE(?, isHelpStaff),
                    defaultWorkingHoursStart = COALESCE(?, defaultWorkingHoursStart),
                    defaultWorkingHoursEnd = COALESCE(?, defaultWorkingHoursEnd),
                    access_key = COALESCE(?, access_key)
                 WHERE id = ?`
            ).bind(
                staffData.name !== undefined ? staffData.name.trim() : null,
                staffData.role !== undefined ? staffData.role : null,
                staffData.hoursTarget !== undefined ? staffData.hoursTarget : null,
                staffData.weeklyHoursTarget !== undefined ? staffData.weeklyHoursTarget : null,
                staffData.isHelpStaff !== undefined ? (staffData.isHelpStaff ? 1 : 0) : null,
                staffData.defaultWorkingHoursStart || null,
                staffData.defaultWorkingHoursEnd || null,
                staffData.accessKey || null,
                id
            )
        ];

        if (staffData.availableDays) {
            // Re-sync available days: Delete old and insert new
            statements.push(context.env.DB.prepare("DELETE FROM staff_available_days WHERE staffId = ?").bind(id));

            staffData.availableDays.forEach((d, idx: number) => {
                const day = typeof d === 'number' ? d : d.day;
                const weeks = typeof d === 'number' ? null : (d.weeks ? JSON.stringify(d.weeks) : null);
                statements.push(
                    context.env.DB.prepare(
                        "INSERT INTO staff_available_days (id, staffId, dayOfWeek, weeks) VALUES (?, ?, ?, ?)"
                    ).bind(`${id}_available_${idx}`, id, day, weeks)
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

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating staff');
    }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return createValidationError('IDが指定されていません');

        await context.env.DB.prepare("DELETE FROM staffs WHERE id = ?").bind(id).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting staff');
    }
};
