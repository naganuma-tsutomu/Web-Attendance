import { z } from 'zod';
import { DateSchema, YearMonthSchema } from './calendarRequestSchemas';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id = z.string().trim().min(1).max(128);
const shiftFields = {
    date: DateSchema,
    staffId: id,
    classType: id,
    startTime: time,
    endTime: time,
    isEarlyShift: z.boolean().optional(),
    isError: z.boolean().optional(),
    duty_number: z.number().int().positive().nullable().optional(),
};

export const ShiftInputSchema = z.object(shiftFields).strict()
    .refine(shift => shift.startTime !== shift.endTime, { path: ['endTime'] });
export const ShiftBatchCreateSchema = z.array(ShiftInputSchema).max(1000);
export const ShiftUpdateSchema = z.object({
    staffId: id.optional(), classType: id.optional(), startTime: time.optional(), endTime: time.optional(),
    isEarlyShift: z.boolean().optional(), isError: z.boolean().optional(),
    duty_number: z.number().int().positive().nullable().optional(),
}).strict().refine(body => Object.keys(body).length > 0);

export const ShiftReplaceSchema = z.object({
    yearMonth: YearMonthSchema,
    expectedVersion: z.number().int().nonnegative(),
    fixedDates: z.array(DateSchema).max(366).optional(),
    shifts: z.array(ShiftInputSchema).max(1000).optional(),
}).strict().superRefine(({ yearMonth, fixedDates = [], shifts = [] }, context) => {
    if (new Set(fixedDates).size !== fixedDates.length) context.addIssue({ code: 'custom', path: ['fixedDates'], message: '固定日が重複しています' });
    fixedDates.forEach((date, index) => {
        if (!date.startsWith(`${yearMonth}-`)) context.addIssue({ code: 'custom', path: ['fixedDates', index], message: '対象月外です' });
    });
    shifts.forEach((shift, index) => {
        if (!shift.date.startsWith(`${yearMonth}-`)) context.addIssue({ code: 'custom', path: ['shifts', index, 'date'], message: '対象月外です' });
    });
});

export const ShiftClearSchema = z.object({
    yearMonth: YearMonthSchema,
    exceptDates: z.array(DateSchema).max(366).optional(),
    clearFixedDates: z.boolean().optional(),
}).strict().superRefine(({ yearMonth, exceptDates = [] }, context) => {
    if (new Set(exceptDates).size !== exceptDates.length) context.addIssue({ code: 'custom', path: ['exceptDates'], message: '日付が重複しています' });
    exceptDates.forEach((date, index) => {
        if (!date.startsWith(`${yearMonth}-`)) context.addIssue({ code: 'custom', path: ['exceptDates', index], message: '対象月外です' });
    });
});

export const ShiftRangeDeleteSchema = z.object({ startDate: DateSchema, endDate: DateSchema }).strict()
    .refine(body => body.startDate <= body.endDate, { path: ['endDate'] });
export const ShiftSnapshotCreateSchema = z.object({
    yearMonth: YearMonthSchema,
    label: z.string().trim().max(100).nullable().optional(),
    reason: z.string().trim().min(1).max(100).optional(),
}).strict();
