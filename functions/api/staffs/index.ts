// NOTE(ARCH-3): 型は src/types から共有。将来的に shared/types.ts へ移行予定
import type { Staff } from '../../../src/types';
import { handleServerError, createValidationError, validateName, validateRole, safeJsonParse } from '../../utils/validation';
import type { Env, D1Row } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        // staffs と available_days を JOIN して一括取得
        const { results: staffRows } = await context.env.DB.prepare(
            "SELECT * FROM staffs ORDER BY display_order ASC"
        ).all();

        const staffIds = (staffRows as D1Row[]).map(r => r.id as string);

        if (staffIds.length === 0) {
            return Response.json([]);
        }

        // available_days と classes を staffId で絞り込んで取得（全件フェッチを廃止）
        const placeholders = staffIds.map(() => '?').join(',');
        const [{ results: allAvailableDays }, { results: allStaffClasses }] = await Promise.all([
            context.env.DB.prepare(
                `SELECT staffId, dayOfWeek, weeks FROM staff_available_days WHERE staffId IN (${placeholders})`
            ).bind(...staffIds).all(),
            context.env.DB.prepare(
                `SELECT staffId, classId FROM staff_classes WHERE staffId IN (${placeholders})`
            ).bind(...staffIds).all(),
        ]);

        // staffId → availableDays / classIds の Map を事前構築
        const availableDaysMap = new Map<string, Array<{ day: number; weeks: number[] | undefined }>>();
        for (const d of allAvailableDays as D1Row[]) {
            const key = d.staffId as string;
            if (!availableDaysMap.has(key)) availableDaysMap.set(key, []);
            availableDaysMap.get(key)!.push({
                day: d.dayOfWeek as number,
                weeks: safeJsonParse(d.weeks as string | null, undefined),
            });
        }

        const classIdsMap = new Map<string, string[]>();
        for (const sc of allStaffClasses as D1Row[]) {
            const key = sc.staffId as string;
            if (!classIdsMap.has(key)) classIdsMap.set(key, []);
            classIdsMap.get(key)!.push(sc.classId as string);
        }

        const staffs = (staffRows as D1Row[]).map((row) => {
            const staffId = row.id as string;
            return {
                ...row,
                availableDays: availableDaysMap.get(staffId) ?? [],
                classIds: classIdsMap.get(staffId) ?? [],
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

        const id = staffData.id || crypto.randomUUID();

        const accessKey = staffData.accessKey || (() => {
            const buf = new Uint32Array(1);
            crypto.getRandomValues(buf);
            return (100000 + (buf[0] % 900000)).toString();
        })();

        const statements = [
            context.env.DB.prepare(
                `INSERT INTO staffs (id, name, role, hoursTarget, weeklyHoursTarget, defaultWorkingHoursStart, defaultWorkingHoursEnd, display_order, access_key)
                 VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM staffs), ?)`
            ).bind(
                id,
                staffData.name!.trim(),
                staffData.role!,
                staffData.hoursTarget ?? null,
                staffData.weeklyHoursTarget ?? null,
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
                    ).bind(crypto.randomUUID(), id, day, weeks)
                );
            });
        }

        // Add statements for staff classes
        if (staffData.classIds && staffData.classIds.length > 0) {
            staffData.classIds.forEach((classId: string) => {
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
