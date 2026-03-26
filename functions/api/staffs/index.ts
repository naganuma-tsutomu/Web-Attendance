import type { Staff } from '../../../src/types';
import { handleServerError, createValidationError, validateName, validateRole, safeJsonParse } from '../../utils/validation';
import type { Env } from '../../types';

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
                    weeks: safeJsonParse(d.weeks, undefined)
                }));

            const classIds = allStaffClasses
                .filter((sc: any) => sc.staffId === staffId)
                .map((sc: any) => sc.classId);

            return {
                ...row,
                availableDays: normalizedDays,
                isHelpStaff: row.isHelpStaff === 1,
                classIds: classIds,
                accessKey: row.access_key,
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

        const accessKey = staffData.accessKey || (() => {
            const buf = new Uint32Array(1);
            crypto.getRandomValues(buf);
            return (100000 + (buf[0] % 900000)).toString();
        })();

        const statements = [
            context.env.DB.prepare(
                `INSERT INTO staffs (id, name, role, hoursTarget, weeklyHoursTarget, isHelpStaff, defaultWorkingHoursStart, defaultWorkingHoursEnd, display_order, access_key)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM staffs), ?)`
            ).bind(
                id,
                staffData.name!.trim(),
                staffData.role!,
                staffData.hoursTarget ?? null,
                staffData.weeklyHoursTarget ?? null,
                staffData.isHelpStaff ? 1 : 0,
                staffData.defaultWorkingHoursStart || null,
                staffData.defaultWorkingHoursEnd || null,
                accessKey
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

        return Response.json({ id });
    } catch (e) {
        return handleServerError(e, 'Database error creating staff');
    }
};
