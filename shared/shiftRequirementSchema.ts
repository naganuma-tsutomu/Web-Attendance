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

type ShiftRequirementDto = z.infer<typeof ShiftRequirementSchema>;

export interface ShiftRequirement extends Omit<ShiftRequirementDto, 'priority'> {
    priority: number;
}
