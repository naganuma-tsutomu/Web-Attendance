// NOTE(ARCH-3): 型は src/types から共有。将来的に shared/types.ts へ移行予定
import type { Staff } from '../../../src/types';
import { handleServerError, createValidationError, validateName, validateRole, safeJsonParse } from '../../utils/validation';
import type { Env, D1Row } from '../../types';
import { getRequestAuthState } from '../../utils';

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const authState = await getRequestAuthState(context.request, context.env.ADMIN_PASSWORD ?? '');

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
            const base = {
                id: row.id,
                name: row.name,
                role: row.role,
                hoursTarget: row.hoursTarget,
                weeklyHoursTarget: row.weeklyHoursTarget,
                defaultWorkingHoursStart: row.defaultWorkingHoursStart,
                defaultWorkingHoursEnd: row.defaultWorkingHoursEnd,
                display_order: row.display_order,
                availableDays: availableDaysMap.get(staffId) ?? [],
                classIds: classIdsMap.get(staffId) ?? [],
            };
            if (authState.kind === 'admin') {
                return {
                    ...base,
                    access_key: row.access_key,
                    accessKey: row.access_key,
                };
            }
            return base;
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

        const generateAccessKey = () => {
            const buf = new Uint32Array(1);
            crypto.getRandomValues(buf);
            return (100000 + (buf[0] % 900000)).toString();
        };

        const isUserProvidedKey = !!staffData.accessKey;
        let accessKey = staffData.accessKey || generateAccessKey();
        const MAX_RETRIES = isUserProvidedKey ? 1 : 5;

        const buildStatements = (key: string) => {
            const stmts = [
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
                    key
                )
            ];
            if (staffData.availableDays && staffData.availableDays.length > 0) {
                staffData.availableDays.forEach((d) => {
                    const day = typeof d === 'number' ? d : d.day;
                    const weeks = typeof d === 'number' ? null : (d.weeks ? JSON.stringify(d.weeks) : null);
                    stmts.push(
                        context.env.DB.prepare(
                            "INSERT INTO staff_available_days (id, staffId, dayOfWeek, weeks) VALUES (?, ?, ?, ?)"
                        ).bind(crypto.randomUUID(), id, day, weeks)
                    );
                });
            }
            if (staffData.classIds && staffData.classIds.length > 0) {
                staffData.classIds.forEach((classId: string) => {
                    stmts.push(
                        context.env.DB.prepare(
                            "INSERT INTO staff_classes (staffId, classId) VALUES (?, ?)"
                        ).bind(id, classId)
                    );
                });
            }
            return stmts;
        };

        // DB の UNIQUE 制約エラーを catch してリトライする（レース条件対応）
        // ユーザー指定キーが衝突した場合は 409 を返す（サイレント書き換えはしない）
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                await context.env.DB.batch(buildStatements(accessKey));
                return Response.json({ id });
            } catch (e) {
                if (e instanceof Error && e.message.includes('UNIQUE constraint failed: staffs.access_key')) {
                    if (isUserProvidedKey) {
                        return new Response(JSON.stringify({ error: '指定されたアクセスキーは既に使用されています' }), {
                            status: 409,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }
                    if (attempt === MAX_RETRIES - 1) {
                        return new Response(JSON.stringify({ error: 'アクセスキーの生成に失敗しました。再度お試しください。' }), {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }
                    accessKey = generateAccessKey();
                } else {
                    throw e;
                }
            }
        }
        return new Response(JSON.stringify({ error: 'アクセスキーの生成に失敗しました。再度お試しください。' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        return handleServerError(e, 'Database error creating staff');
    }
};
