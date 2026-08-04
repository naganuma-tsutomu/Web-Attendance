import { z } from 'zod';

const isRealDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const DateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).refine(isRealDate);
export const YearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(value => {
    const year = Number(value.slice(0, 4));
    return year >= 2000 && year <= 2100;
});

export const HolidayCreateSchema = z.object({
    date: DateSchema,
    name: z.string().trim().min(1).max(100),
    type: z.enum(['national', 'observance', 'company']).optional(),
    isWorkday: z.boolean().optional(),
}).strict();

export const HolidayUpdateSchema = HolidayCreateSchema.omit({ date: true }).partial()
    .refine(body => Object.keys(body).length > 0);

const overrideFields = {
    status: z.enum(['open', 'closed']),
    name: z.string().trim().max(100).optional(),
};
export const BusinessDayOverrideCreateSchema = z.object({ date: DateSchema, ...overrideFields }).strict();
export const BusinessDayOverrideUpdateSchema = z.object(overrideFields).partial()
    .refine(body => Object.keys(body).length > 0);
export const BusinessDayOverrideBulkSchema = z.object({
    startDate: DateSchema,
    endDate: DateSchema,
    ...overrideFields,
}).strict().refine(body => body.startDate <= body.endDate, { path: ['endDate'] });

export const FixedDatesReplaceSchema = z.object({
    yearMonth: YearMonthSchema,
    dates: z.array(DateSchema).max(366),
}).strict().superRefine(({ yearMonth, dates }, context) => {
    if (new Set(dates).size !== dates.length) context.addIssue({ code: 'custom', path: ['dates'], message: '日付が重複しています' });
    dates.forEach((date, index) => {
        if (!date.startsWith(`${yearMonth}-`)) context.addIssue({ code: 'custom', path: ['dates', index], message: '対象月以外の日付です' });
    });
});

export const FixedDateToggleSchema = z.object({ date: DateSchema, fixed: z.boolean() }).strict();
