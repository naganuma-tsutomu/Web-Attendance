import { z } from 'zod';
import { DateSchema, YearMonthSchema } from './calendarRequestSchemas';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** API・フロント間で共有する希望休明細DTO。 */
export const ShiftPreferenceDetailSchema = z.object({
    date: DateSchema,
    startTime: time.optional().nullable(),
    endTime: time.optional().nullable(),
    type: z.string().max(50).optional().nullable(),
}).strict().refine(detail => Boolean(detail.startTime) === Boolean(detail.endTime), { path: ['endTime'] });

/** API・フロント間で共有する希望休DTO。 */
export const ShiftPreferenceSchema = z.object({
    id: z.string(),
    staffId: z.string(),
    yearMonth: z.string(),
    submitted: z.boolean().optional(),
    details: z.array(ShiftPreferenceDetailSchema).optional(),
});

export const ShiftPreferenceRequestSchema = z.object({
    staffId: z.string().trim().min(1).max(128),
    yearMonth: YearMonthSchema,
    submitted: z.boolean().optional(),
    details: z.array(ShiftPreferenceDetailSchema).max(366).optional(),
}).strict().superRefine(({ yearMonth, details = [] }, context) => {
    details.forEach((detail, index) => {
        if (!detail.date.startsWith(`${yearMonth}-`)) context.addIssue({ code: 'custom', path: ['details', index, 'date'], message: '対象月外です' });
    });
});

export const ShiftPreferenceSubmissionSchema = z.object({
    staffId: z.string().trim().min(1).max(128),
    yearMonth: YearMonthSchema,
    submitted: z.boolean(),
}).strict();

export type ShiftPreferenceDetail = z.infer<typeof ShiftPreferenceDetailSchema>;
export type ShiftPreference = z.infer<typeof ShiftPreferenceSchema>;
