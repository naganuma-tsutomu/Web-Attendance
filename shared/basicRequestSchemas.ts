import { z } from 'zod';

export const AdminLoginSchema = z.object({ password: z.string().min(1).max(1024) }).strict();
export const StaffLoginSchema = z.object({
    name: z.string().trim().min(1).max(100),
    accessKey: z.string().trim().regex(/^\d{6}$/),
}).strict();
export const FacilityUpdateSchema = z.object({ name: z.string().trim().min(1).max(50) }).strict();
export const RequirementTemplateNameSchema = z.object({ name: z.string().trim().min(1).max(50) }).strict();
