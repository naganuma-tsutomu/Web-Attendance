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

export const formatAppSettingsInputError = (error: z.ZodError, fallback: string): string => {
    const issue = error.issues[0];
    if (!issue) return fallback;
    const field = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${field}${issue.message}`;
};
