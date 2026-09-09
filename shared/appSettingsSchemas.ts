import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM形式で指定してください');
const identifier = z.string().trim().min(1).max(200);

export const BusinessHoursSchema = z.object({
    startHour: z.number().finite().min(0).max(23.5).multipleOf(0.5).default(8),
    endHour: z.number().finite().min(0.5).max(24).multipleOf(0.5).default(19),
    closedDays: z.array(z.number().int().min(0).max(7))
        .max(8)
        .refine(days => new Set(days).size === days.length, '休館日を重複して指定できません')
        .default([0]),
}).strict().superRefine((settings, context) => {
    if (settings.startHour >= settings.endHour) {
        context.addIssue({
            code: 'custom',
            path: ['startHour'],
            message: '開始時間は終了時間より前に設定してください',
        });
    } else if (settings.endHour - settings.startHour < 2) {
        context.addIssue({
            code: 'custom',
            path: ['endHour'],
            message: '営業時間は最低2時間必要です',
        });
    }
});

export const BreakSettingsSchema = z.object({
    exceptionEnabled: z.boolean().default(false),
    exceptionThresholdTime: time.default('12:00'),
    exceptionBreakMinutes: z.number().int().min(0).max(120).default(30),
    displayActualHoursInModal: z.boolean().default(false),
    displayActualHoursInExcel: z.boolean().default(false),
}).strict();

export const ExcelHighlightRuleSchema = z.object({
    staffId: identifier,
    regularStartTime: time,
    regularEndTime: time,
    highlightColor: z.string().regex(/^[0-9a-fA-F]{8}$/, '色は8桁のARGB形式で指定してください').default('FFFFCCE5'),
}).strict();

export const ExcelSettingsSchema = z.object({
    excludeHolidayStaffOnSaturdays: z.boolean().default(true),
    highlightRules: z.array(ExcelHighlightRuleSchema).max(500).default([]),
    showDutyNumbers: z.boolean().default(false),
    leaderRoleId: identifier.nullable().default(null),
}).strict();

export const SchedulePreferencesSchema = z.object({
    autoOpenGenerationReport: z.boolean().default(true),
}).strict();

const rotationIdentifier = z.string().trim().max(200);
const rotationCount = z.number().int().min(0).max(100);
const rotationSettingsFields = {
    enabled: z.boolean(),
    roleId: rotationIdentifier,
    earlyPatternId: rotationIdentifier,
    latePatternId: rotationIdentifier,
    weekdayEarlyCount: rotationCount,
    weekdayLateCount: rotationCount,
    saturdayEnabled: z.boolean(),
    saturdayCount: rotationCount,
    saturdayPreferFridayLate: z.boolean(),
    saturdayPatternId: rotationIdentifier.optional(),
};

type RotationSettingsValue = {
    enabled: boolean;
    roleId: string;
    earlyPatternId: string;
    latePatternId: string;
    saturdayEnabled: boolean;
    saturdayPatternId?: string;
};

const validateRotationSettings = (settings: RotationSettingsValue, context: z.RefinementCtx): void => {
    if (!settings.enabled) return;
    if (!settings.roleId || !settings.earlyPatternId || !settings.latePatternId) {
        context.addIssue({
            code: 'custom',
            message: '有効化するには対象区分、早番、遅番のパターンを指定してください',
        });
    } else if (settings.earlyPatternId === settings.latePatternId) {
        context.addIssue({
            code: 'custom',
            path: ['latePatternId'],
            message: '早番と遅番には異なるパターンを指定してください',
        });
    }
    if (settings.saturdayEnabled && !settings.saturdayPatternId) {
        context.addIssue({
            code: 'custom',
            path: ['saturdayPatternId'],
            message: '土曜日を有効にする場合は土曜日のパターンを指定してください',
        });
    }
};

export const RotationSettingsRequestSchema = z.object(rotationSettingsFields)
    .strict()
    .superRefine(validateRotationSettings);

export const RotationSettingsSchema = z.object({
    enabled: rotationSettingsFields.enabled.default(false),
    roleId: rotationSettingsFields.roleId.default(''),
    earlyPatternId: rotationSettingsFields.earlyPatternId.default(''),
    latePatternId: rotationSettingsFields.latePatternId.default(''),
    weekdayEarlyCount: rotationSettingsFields.weekdayEarlyCount.default(1),
    weekdayLateCount: rotationSettingsFields.weekdayLateCount.default(2),
    saturdayEnabled: rotationSettingsFields.saturdayEnabled.default(true),
    saturdayCount: rotationSettingsFields.saturdayCount.default(1),
    saturdayPreferFridayLate: rotationSettingsFields.saturdayPreferFridayLate.default(true),
    saturdayPatternId: rotationSettingsFields.saturdayPatternId,
}).strict().superRefine(validateRotationSettings);

export const formatAppSettingsInputError = (error: z.ZodError, fallback: string): string => {
    const issue = error.issues[0];
    if (!issue) return fallback;
    const field = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${field}${issue.message}`;
};

export const formatRotationSettingsInputError = (error: z.ZodError): string => {
    const issue = error.issues[0];
    if (!issue) return 'ローテーション設定の形式が正しくありません';
    if (issue.code === 'custom') return issue.message;

    const field = issue.path[0];
    if (field === 'enabled' || field === 'saturdayEnabled' || field === 'saturdayPreferFridayLate') {
        return `${String(field)} は真偽値で指定してください`;
    }
    if (field === 'roleId' || field === 'earlyPatternId' || field === 'latePatternId' || field === 'saturdayPatternId') {
        return `${String(field)} は200文字以内の文字列で指定してください`;
    }
    if (field === 'weekdayEarlyCount' || field === 'weekdayLateCount' || field === 'saturdayCount') {
        return `${String(field)} は0以上100以下の整数で指定してください`;
    }
    return 'ローテーション設定の形式が正しくありません';
};
