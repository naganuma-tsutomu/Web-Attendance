import { z } from 'zod';

/** API・フロント間で共有する必要人数設定のDTOスキーマ。 */
export const ShiftRequirementSchema = z.object({
    id: z.string(),
    classId: z.string(),
    dayOfWeek: z.number().int(),
    startTime: z.string(),
    endTime: z.string(),
    minStaffCount: z.number().int(),
    maxStaffCount: z.number().int().optional().nullable(),
    priority: z.number().optional().nullable(),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const requirementFields = {
    id: z.string().trim().min(1).max(128).optional(),
    classId: z.string().trim().min(1).max(128),
    dayOfWeek: z.number().int().min(0).max(8),
    startTime: time,
    endTime: time,
    minStaffCount: z.number().int().min(1).max(999),
    maxStaffCount: z.number().int().min(1).max(999).nullable().optional(),
    priority: z.number().int().min(0).max(999).optional().nullable(),
};
export const ShiftRequirementRequestSchema = z.object(requirementFields).strict()
    .refine(item => item.startTime !== item.endTime, { path: ['endTime'] })
    .refine(item => item.maxStaffCount == null || item.maxStaffCount >= item.minStaffCount, { path: ['maxStaffCount'] });
export const ShiftRequirementsRequestSchema = z.union([
    ShiftRequirementRequestSchema,
    z.array(ShiftRequirementRequestSchema).max(1000),
]);
export const ShiftRequirementUpdateSchema = z.object(requirementFields).partial().strict()
    .refine(body => Object.keys(body).length > 0);

type ShiftRequirementDto = z.infer<typeof ShiftRequirementSchema>;

export interface ShiftRequirement extends Omit<ShiftRequirementDto, 'priority'> {
    priority: number;
}
