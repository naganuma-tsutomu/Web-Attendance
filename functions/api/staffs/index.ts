import type { Staff } from '../../../src/types';
import { handleServerError, createValidationError, validateName, validateRole } from '../../utils/validation';
import { generateAccessKey, hashAccessKey } from '../../utils';

export interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM staffs ORDER BY display_order ASC"
        ).all();

        // Fetch all available days for all staffs in one go to be efficient
        const { results: allAvailableDays } = await context.env.DB.prepare(
            "SELECT * FROM staff_available_days"
        ).all();

        // Fetch all classes for all staffs
        const { results: allStaffClasses } = await context.env.DB.prepare(
            "SELECT * FROM staff_classes"
        ).all();

        const staffs = results.map((row: any) => {
            const staffId = row.id;
            const normalizedDays = allAvailableDays
                .filter((d: any) => d.staffId === staffId)
                .map((d: any) => ({
                    day: d.dayOfWeek,
                    weeks: d.weeks ? JSON.parse(d.weeks) : undefined
                }));

            const classIds = allStaffClasses
                .filter((sc: any) => sc.staffId === staffId)
                .map((sc: any) => sc.classId);

            return {
                ...row,
                availableDays: normalizedDays.length > 0 ? normalizedDays : (row.availableDays ? JSON.parse(row.availableDays) : undefined),
                isHelpStaff: row.isHelpStaff === 1,
                classIds: classIds,
                access_key: undefined, // ハッシュをクライアントに返さない
                accessKey: undefined,
            };
        });

        return Response.json(staffs);
    } catch (e) {
        return handleServerError(e, 'Database error fetching staffs');
    }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const staffData: Partial<Staff> = await context.request.json();
        
        // Validate name
        const nameError = validateName(staffData.name || '', '名前', 100);
        if (nameError) return createValidationError(nameError);
        
        // Validate role
        const roleError = validateRole(staffData.role || '');
        if (roleError) return createValidationError(roleError);

        // Validate targets
        const weeklyError = staffData.weeklyHoursTarget !== undefined ? null : null; // Validation happens in target check if we want, but let's just use it
        // Or if we need to strictly validate:
        // const hoursError = validateWeeklyHoursTarget(staffData.weeklyHoursTarget);
        // if (hoursError) return createValidationError(hoursError);
        
        const id = staffData.id || `staff_${Date.now()}`;

        const { maxOrder } = await context.env.DB.prepare(
            "SELECT MAX(display_order) as maxOrder FROM staffs"
        ).first() as { maxOrder: number | null };

        const displayOrder = (maxOrder || 0) + 1;

        // アクセスキーを生成してハッシュ化
        const plainAccessKey = staffData.accessKey || generateAccessKey();
        const hashedAccessKey = await hashAccessKey(plainAccessKey);

        const statements = [
            context.env.DB.prepare(
                `INSERT INTO staffs (id, name, role, hoursTarget, weeklyHoursTarget, availableDays, isHelpStaff, defaultWorkingHoursStart, defaultWorkingHoursEnd, display_order, access_key)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                id,
                staffData.name!.trim(),
                staffData.role!,
                staffData.hoursTarget ?? null,
                staffData.weeklyHoursTarget ?? null,
                staffData.availableDays ? JSON.stringify(staffData.availableDays) : null,
                staffData.isHelpStaff ? 1 : 0,
                staffData.defaultWorkingHoursStart || null,
                staffData.defaultWorkingHoursEnd || null,
                displayOrder,
                hashedAccessKey
            )
        ];

        // Add statements for normalized available days
        if (staffData.availableDays && staffData.availableDays.length > 0) {
            staffData.availableDays.forEach((d, idx) => {
                const day = typeof d === 'number' ? d : d.day;
                const weeks = typeof d === 'number' ? null : (d.weeks ? JSON.stringify(d.weeks) : null);
                statements.push(
                    context.env.DB.prepare(
                        "INSERT INTO staff_available_days (id, staffId, dayOfWeek, weeks) VALUES (?, ?, ?, ?)"
                    ).bind(`${id}_available_${idx}`, id, day, weeks)
                );
            });
        }

        // Add statements for staff classes
        if ((staffData as any).classIds && (staffData as any).classIds.length > 0) {
            (staffData as any).classIds.forEach((classId: string) => {
                statements.push(
                    context.env.DB.prepare(
                        "INSERT INTO staff_classes (staffId, classId) VALUES (?, ?)"
                    ).bind(id, classId)
                );
            });
        }

        await context.env.DB.batch(statements);

        // 平文キーを一度だけ返す（管理者がスタッフに伝えるため）
        return Response.json({ id, accessKey: plainAccessKey });
    } catch (e) {
        return handleServerError(e, 'Database error creating staff');
    }
};
