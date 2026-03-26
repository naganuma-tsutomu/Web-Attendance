import { z } from 'zod';

export const AvailableDayConfigSchema = z.object({
  day: z.number().int().min(0).max(6),
  weeks: z.array(z.number().int()).optional().nullable(),
});

export const StaffSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  hoursTarget: z.number().nullable().optional(),
  weeklyHoursTarget: z.number().nullable().optional(),
  isHelpStaff: z.union([z.boolean(), z.number()]).optional().nullable(),
  classIds: z.array(z.string()).optional(),
  availableDays: z.array(z.union([z.number(), AvailableDayConfigSchema])).optional(),
  defaultWorkingHoursStart: z.string().optional().nullable(),
  defaultWorkingHoursEnd: z.string().optional().nullable(),
  display_order: z.number().optional().nullable(),
  accessKey: z.string().optional().nullable(),
  access_key: z.string().optional().nullable(), // DB生のキーも拾えるか無視させる保険
});

export const ShiftClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_order: z.number().optional().nullable(),
  auto_allocate: z.union([z.boolean(), z.number()]).optional().nullable(),
  color: z.string().optional().nullable(),
});

export const ShiftPreferenceDetailSchema = z.object({
  date: z.string(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
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
  isEarlyShift: z.union([z.boolean(), z.number()]).optional().nullable(),
  isError: z.union([z.boolean(), z.number()]).optional().nullable(),
});

export const ShiftTimePatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  roleIds: z.array(z.string()).optional(),
  display_order: z.number().optional().nullable(),
});

export const DynamicRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetHours: z.number().optional().nullable(),
  weeklyHoursTarget: z.number().optional().nullable(),
  display_order: z.number().optional().nullable(),
});

export const ShiftRequirementSchema = z.object({
    id: z.string(),
    classId: z.string(),
    dayOfWeek: z.number().int(),
    startTime: z.string(),
    endTime: z.string(),
    minStaffCount: z.number().int(),
    maxStaffCount: z.number().int().optional().nullable(),
    priority: z.number().optional().nullable()
});

export const HolidaySchema = z.object({
    id: z.string(),
    date: z.string(),
    name: z.string(),
    type: z.string(),
    is_workday: z.union([z.boolean(), z.number()]).optional().nullable()
});

export const BusinessHoursSchema = z.object({
    startHour: z.number().int(),
    endHour: z.number().int(),
    closedDays: z.array(z.number().int()).optional()
});
