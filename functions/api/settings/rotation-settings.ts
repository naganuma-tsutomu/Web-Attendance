import { createValidationError, handleServerError } from '../../utils/validation';
import type { Env } from '../../types';

type RotationSettingsPayload = {
    enabled: boolean;
    roleId: string;
    earlyPatternId: string;
    latePatternId: string;
    weekdayEarlyCount: number;
    weekdayLateCount: number;
    saturdayEnabled: boolean;
    saturdayCount: number;
    saturdayPreferFridayLate: boolean;
    saturdayPatternId?: string;
};

const DEFAULT_SETTINGS: RotationSettingsPayload = {
    enabled: false,
    roleId: '',
    earlyPatternId: '',
    latePatternId: '',
    weekdayEarlyCount: 1,
    weekdayLateCount: 2,
    saturdayEnabled: true,
    saturdayCount: 1,
    saturdayPreferFridayLate: true,
};

const parseRotationSettings = (value: unknown): RotationSettingsPayload | string => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return 'ローテーション設定の形式が正しくありません';
    }
    const body = value as Record<string, unknown>;
    const booleanFields = ['enabled', 'saturdayEnabled', 'saturdayPreferFridayLate'] as const;
    for (const field of booleanFields) {
        if (typeof body[field] !== 'boolean') return `${field} は真偽値で指定してください`;
    }
    const stringFields = ['roleId', 'earlyPatternId', 'latePatternId'] as const;
    for (const field of stringFields) {
        if (typeof body[field] !== 'string') return `${field} は文字列で指定してください`;
    }
    if (body.saturdayPatternId !== undefined && typeof body.saturdayPatternId !== 'string') {
        return 'saturdayPatternId は文字列で指定してください';
    }
    const countFields = ['weekdayEarlyCount', 'weekdayLateCount', 'saturdayCount'] as const;
    for (const field of countFields) {
        const count = body[field];
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100) {
            return `${field} は0以上100以下の整数で指定してください`;
        }
    }
    if (body.enabled) {
        if (!body.roleId || !body.earlyPatternId || !body.latePatternId) {
            return '有効化するには対象区分、早番、遅番のパターンを指定してください';
        }
        if (body.earlyPatternId === body.latePatternId) {
            return '早番と遅番には異なるパターンを指定してください';
        }
        if (body.saturdayEnabled && !body.saturdayPatternId) {
            return '土曜日を有効にする場合は土曜日のパターンを指定してください';
        }
    }

    return {
        enabled: body.enabled as boolean,
        roleId: body.roleId as string,
        earlyPatternId: body.earlyPatternId as string,
        latePatternId: body.latePatternId as string,
        weekdayEarlyCount: body.weekdayEarlyCount as number,
        weekdayLateCount: body.weekdayLateCount as number,
        saturdayEnabled: body.saturdayEnabled as boolean,
        saturdayCount: body.saturdayCount as number,
        saturdayPreferFridayLate: body.saturdayPreferFridayLate as boolean,
        saturdayPatternId: body.saturdayPatternId as string | undefined,
    };
};

// GET /api/settings/rotation-settings — ローテーション設定を取得
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { results } = await context.env.DB.prepare(
            `SELECT value FROM app_settings WHERE key = 'rotation_settings'`
        ).all<{ value: string }>();

        if (results.length === 0) {
            return Response.json(DEFAULT_SETTINGS);
        }

        return Response.json(JSON.parse(results[0].value));
    } catch (e) {
        return handleServerError(e, 'Database error fetching rotation settings');
    }
};

// PUT /api/settings/rotation-settings — ローテーション設定を更新
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const parsed = parseRotationSettings(await context.request.json());
        if (typeof parsed === 'string') return createValidationError(parsed);

        await context.env.DB.prepare(
            `INSERT INTO app_settings (key, value) VALUES ('rotation_settings', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind(JSON.stringify(parsed)).run();

        return Response.json({ success: true });
    } catch (e) {
        return handleServerError(e, 'Database error updating rotation settings');
    }
};
