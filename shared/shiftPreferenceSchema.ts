import { z } from 'zod';

/** API・フロント間で共有する希望休明細DTO。 */
export const ShiftPreferenceDetailSchema = z.object({
    date: z.string(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
});

/** API・フロント間で共有する希望休DTO。 */
export const ShiftPreferenceSchema = z.object({
    id: z.string(),
    staffId: z.string(),
    yearMonth: z.string(),
    submitted: z.boolean().optional(),
    details: z.array(ShiftPreferenceDetailSchema).optional(),
});

export type ShiftPreferenceDetail = z.infer<typeof ShiftPreferenceDetailSchema>;
export type ShiftPreference = z.infer<typeof ShiftPreferenceSchema>;
