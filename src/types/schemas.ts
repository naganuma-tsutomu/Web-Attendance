import { z } from 'zod';

export const AvailableDayConfigSchema = z.object({
  day: z.number().int().min(0).max(6),
  weeks: z.array(z.number().int()).optional().nullable(),
});

export const StaffSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  hoursTarget: z.number().nullable(),
  weeklyHoursTarget: z.number().nullable().optional(),
  isHelpStaff: z.boolean().optional(),
  classIds: z.array(z.string()).optional(),
  availableDays: z.array(z.union([z.number(), AvailableDayConfigSchema])).optional(),
  defaultWorkingHoursStart: z.string().optional(),
  defaultWorkingHoursEnd: z.string().optional(),
  display_order: z.number().optional(),
  accessKey: z.string().optional(),
});

export const ShiftClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_order: z.number(),
  auto_allocate: z.number(),
  color: z.string().optional().nullable(),
});

export const ShiftPreferenceDetailSchema = z.object({
  date: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  type: z.string().optional().nullable(),
});

export const ShiftPreferenceSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  yearMonth: z.string(),
  details: z.array(ShiftPreferenceDetailSchema).optional(),
});

export const ShiftSchema = z.object({
  id: z.string(),
  date: z.string(),
  staffId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  classType: z.string(),
  isEarlyShift: z.boolean(),
  isError: z.boolean().optional(),
});

export const ShiftTimePatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  roleIds: z.array(z.string()).optional(),
  display_order: z.number().optional(),
});

export const DynamicRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetHours: z.number().optional(),
  weeklyHoursTarget: z.number().optional(),
  display_order: z.number().optional(),
});

export const ShiftRequirementSchema = z.object({
    id: z.string(),
    classId: z.string(),
    dayOfWeek: z.number().int(),
    startTime: z.string(),
    endTime: z.string(),
    minStaffCount: z.number().int(),
    maxStaffCount: z.number().int().nullable().optional(),
    priority: z.number().optional()
});

export const HolidaySchema = z.object({
    id: z.string(),
    date: z.string(),
    name: z.string(),
    type: z.string(),
    is_workday: z.boolean().optional()
});

export const BusinessHoursSchema = z.object({
    startHour: z.number().int(),
    endHour: z.number().int(),
    closedDays: z.array(z.number().int())
});
