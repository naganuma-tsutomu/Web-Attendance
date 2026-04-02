import { handleServerError, createValidationError, validateName, validateRole } from '../../utils/validation';
import type { Env, D1Row, D1BindParam } from '../../types';

// staffs テーブルで更新を許可するカラム名のホワイトリスト
const ALLOWED_STAFF_COLUMNS = new Set([
    'name', 'role', 'hoursTarget', 'weeklyHoursTarget',
    'defaultWorkingHoursStart', 'defaultWorkingHoursEnd', 'access_key',
]);

/**
 * setClauses に追加する前にカラム名がホワイトリストに含まれているか検証する。
 * 不正なカラム名が検出された場合は例外をスローする。
 */
const addSetClause = (setClauses: string[], binds: D1BindParam[], column: string, value: D1BindParam) => {
    if (!ALLOWED_STAFF_COLUMNS.has(column)) {
        throw new Error(`Invalid column name: ${column}`);
    }
    setClauses.push(`${column} = ?`);
    binds.push(value);
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);
        const id = url.pathname.split('/').pop();
        if (!id) return createValidationError('IDが指定されていません');

        const staffData = await context.request.json() as Partial<{
            name: string; role: string; hoursTarget: number | null;
            weeklyHoursTarget: number | null;
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

        // 更新するカラムを動的に構築（undefined = 更新しない、null = NULL を書き込む）
        // addSetClause() でホワイトリスト検証済みのカラム名のみ追加
        const setClauses: string[] = [];
        const binds: D1BindParam[] = [];

        if (staffData.name !== undefined) {
            addSetClause(setClauses, binds, 'name', staffData.name.trim());
        }
        if (staffData.role !== undefined) {
            addSetClause(setClauses, binds, 'role', staffData.role);
        }
        if (staffData.hoursTarget !== undefined) {
            addSetClause(setClauses, binds, 'hoursTarget', staffData.hoursTarget);
        }
        if (staffData.weeklyHoursTarget !== undefined) {
            addSetClause(setClauses, binds, 'weeklyHoursTarget', staffData.weeklyHoursTarget);
        }
        if (staffData.defaultWorkingHoursStart !== undefined) {
            addSetClause(setClauses, binds, 'defaultWorkingHoursStart', staffData.defaultWorkingHoursStart || null);
        }
        if (staffData.defaultWorkingHoursEnd !== undefined) {
            addSetClause(setClauses, binds, 'defaultWorkingHoursEnd', staffData.defaultWorkingHoursEnd || null);
        }
        if (staffData.accessKey !== undefined) {
            addSetClause(setClauses, binds, 'access_key', staffData.accessKey || null);
        }

        const statements = [];

        if (setClauses.length > 0) {
            binds.push(id);
            statements.push(
                context.env.DB.prepare(
                    `UPDATE staffs SET ${setClauses.join(', ')} WHERE id = ?`
                ).bind(...binds)
            );
        }

        if (staffData.availableDays) {
            // Re-sync available days: Delete old and insert new
            statements.push(context.env.DB.prepare("DELETE FROM staff_available_days WHERE staffId = ?").bind(id));

            staffData.availableDays.forEach((d, idx: number) => {
                const day = typeof d === 'number' ? d : d.day;
                const weeks = typeof d === 'number' ? null : (d.weeks ? JSON.stringify(d.weeks) : null);
                statements.push(
                    context.env.DB.prepare(
                        "INSERT INTO staff_available_days (id, staffId, dayOfWeek, weeks) VALUES (?, ?, ?, ?)"
                    ).bind(crypto.randomUUID(), id, day, weeks)
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

        // ON DELETE CASCADE により staff_available_days, staff_classes,
        // shifts, shift_preferences, shift_preference_dates も連動して削除される
        await context.env.DB.prepare("DELETE FROM staffs WHERE id = ?").bind(id).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error deleting staff');
    }
};
