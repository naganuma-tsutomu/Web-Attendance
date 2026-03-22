import { handleServerError, createValidationError, validateName, validateRole } from '../../utils/validation';
import { hashAccessKey } from '../../utils';

export interface Env {
    DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return createValidationError('IDが指定されていません');

        const staffData: any = await context.request.json();
        
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

        // アクセスキーが更新される場合はハッシュ化
        let hashedAccessKey: string | null = null;
        if (staffData.accessKey) {
            hashedAccessKey = await hashAccessKey(staffData.accessKey);
        }

        const statements = [
            context.env.DB.prepare(
                `UPDATE staffs SET
                    name = COALESCE(?, name),
                    role = COALESCE(?, role),
                    hoursTarget = COALESCE(?, hoursTarget),
                    weeklyHoursTarget = COALESCE(?, weeklyHoursTarget),
                    availableDays = COALESCE(?, availableDays),
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
                staffData.availableDays ? JSON.stringify(staffData.availableDays) : null,
                staffData.isHelpStaff !== undefined ? (staffData.isHelpStaff ? 1 : 0) : null,
                staffData.defaultWorkingHoursStart || null,
                staffData.defaultWorkingHoursEnd || null,
                hashedAccessKey,
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

        // キーが更新された場合は平文を一度だけ返す
        const response: { success: boolean; accessKey?: string } = { success: true };
        if (staffData.accessKey) {
            response.accessKey = staffData.accessKey;
        }
        return Response.json(response);
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
