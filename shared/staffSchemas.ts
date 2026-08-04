import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM形式で指定してください');
const nullableTimeSchema = timeSchema.nullable();
const accessKeySchema = z.string().regex(/^\d{6}$/, '6桁の数字で指定してください').nullable();

const availableDaySchema = z.union([
    z.number().int().min(0).max(6),
    z.object({
        day: z.number().int().min(0).max(6),
        weeks: z.array(z.number().int().min(1).max(5)).max(5).optional().nullable(),
    }).strict(),
]);

const staffFields = {
    name: z.string().trim().min(1, '名前を入力してください').max(100, '名前は100文字以内で入力してください'),
    role: z.string().trim().min(1, 'スタッフ区分を入力してください').max(100),
    hoursTarget: z.number().finite().min(0).max(999).nullable(),
    weeklyHoursTarget: z.number().finite().min(0).max(168).nullable(),
    defaultWorkingHoursStart: nullableTimeSchema,
    defaultWorkingHoursEnd: nullableTimeSchema,
    accessKey: accessKeySchema,
    availableDays: z.array(availableDaySchema).max(7),
    classIds: z.array(z.string().trim().min(1)).refine(ids => new Set(ids).size === ids.length, {
        message: 'クラスIDを重複して指定できません',
    }),
};

export const StaffCreateInputSchema = z.object({
    id: z.string().trim().min(1).optional(),
    name: staffFields.name,
    role: staffFields.role,
    hoursTarget: staffFields.hoursTarget.optional(),
    weeklyHoursTarget: staffFields.weeklyHoursTarget.optional(),
    defaultWorkingHoursStart: staffFields.defaultWorkingHoursStart.optional(),
    defaultWorkingHoursEnd: staffFields.defaultWorkingHoursEnd.optional(),
    accessKey: staffFields.accessKey.optional(),
    availableDays: staffFields.availableDays.optional(),
    classIds: staffFields.classIds.optional(),
}).strict();

export const StaffUpdateInputSchema = z.object(staffFields).partial().strict();

export type StaffCreateInput = z.infer<typeof StaffCreateInputSchema>;
export type StaffUpdateInput = z.infer<typeof StaffUpdateInputSchema>;

export const formatStaffInputError = (error: z.ZodError): string => {
    const issue = error.issues[0];
    const field = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${field}${issue.message}`;
};
