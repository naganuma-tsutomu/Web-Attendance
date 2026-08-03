import { z } from 'zod';

// ==========================================
// Zod スキーマ定義 (Single Source of Truth)
// TypeScript 型はすべてここから z.infer<> で生成する
// ==========================================

export const AvailableDayConfigSchema = z.object({
  day: z.number().int().min(0).max(6),
  weeks: z.array(z.number().int()).optional().nullable(),
});

export const StaffSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  hoursTarget: z.number().nullable().default(null),
  weeklyHoursTarget: z.number().nullable().default(null),
  classIds: z.array(z.string()).optional(),
  availableDays: z.array(z.union([z.number(), AvailableDayConfigSchema])).optional(),
  defaultWorkingHoursStart: z.string().optional().nullable(),
  defaultWorkingHoursEnd: z.string().optional().nullable(),
  display_order: z.number().optional().nullable(),
  accessKey: z.string().optional().nullable(),
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
  submitted: z.boolean().optional(),
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
  duty_number: z.number().int().nullable().optional(),
});

export const ShiftSnapshotMetadataSchema = z.object({
  id: z.string(),
  yearMonth: z.string(),
  label: z.string().nullable().optional(),
  reason: z.string(),
  shiftCount: z.number().int(),
  createdAt: z.string(),
});

export const ShiftTimePatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  roleIds: z.array(z.string()).optional(),
  display_order: z.number().optional().nullable(),
  sun: z.number().optional().default(1),
  mon: z.number().optional().default(1),
  tue: z.number().optional().default(1),
  wed: z.number().optional().default(1),
  thu: z.number().optional().default(1),
  fri: z.number().optional().default(1),
  sat: z.number().optional().default(1),
  holiday: z.number().optional().default(1),
});

export const DynamicRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetHours: z.number().optional().nullable(),
  weeklyHoursTarget: z.number().optional().nullable(),
  display_order: z.number().optional().nullable(),
  patterns: z.array(ShiftTimePatternSchema).optional().default([]),
});

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

export const ShiftRequirementTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const HolidaySchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  type: z.string(),
  isWorkday: z.union([z.boolean(), z.number()]).optional().nullable(),
  is_workday: z.union([z.boolean(), z.number()]).optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export const BusinessDayOverrideSchema = z.object({
  id: z.string(),
  date: z.string(),
  status: z.enum(['open', 'closed']),
  name: z.string(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export const BusinessHoursSchema = z.object({
  startHour: z.number().multipleOf(0.5),
  endHour: z.number().multipleOf(0.5),
  closedDays: z.array(z.number().int()).optional(),
});

export const ExcelHighlightRuleSchema = z.object({
  staffId: z.string(),
  regularStartTime: z.string(),
  regularEndTime: z.string(),
  highlightColor: z.string().default('FFFFCCE5'), // Pink
});

export const ExcelSettingsSchema = z.object({
  excludeHolidayStaffOnSaturdays: z.boolean().default(true),
  highlightRules: z.array(ExcelHighlightRuleSchema).default([]),
  showDutyNumbers: z.boolean().default(false),
  leaderRoleId: z.string().nullable().default(null),
});

export const BreakSettingsSchema = z.object({
  exceptionEnabled: z.boolean().default(false),
  exceptionThresholdTime: z.string().default('12:00'),
  exceptionBreakMinutes: z.number().int().default(30),
  displayActualHoursInModal: z.boolean().default(false),
  displayActualHoursInExcel: z.boolean().default(false),
});

export const SchedulePreferencesSchema = z.object({
  autoOpenGenerationReport: z.boolean().default(true),
});

export const RotationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  roleId: z.string().default(''),
  earlyPatternId: z.string().default(''),
  latePatternId: z.string().default(''),
  weekdayEarlyCount: z.number().int().min(0).max(100).default(1),
  weekdayLateCount: z.number().int().min(0).max(100).default(2),
  saturdayEnabled: z.boolean().default(false),
  saturdayCount: z.number().int().min(0).max(100).default(1),
  saturdayPreferFridayLate: z.boolean().default(true),
  saturdayPatternId: z.string().optional(),
});

export const AuditLogSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  actorType: z.enum(['admin', 'staff', 'system']),
  actorId: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  yearMonth: z.string().nullable(),
  targetDate: z.string().nullable(),
  summary: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  requestId: z.string().nullable(),
});

export const AuditLogPageSchema = z.object({
  items: z.array(AuditLogSchema),
  nextCursor: z.string().nullable(),
});

// ==========================================
// z.infer<> で TypeScript 型を生成
// ==========================================
export type AvailableDayConfig = z.infer<typeof AvailableDayConfigSchema>;
export type StaffInferred = z.infer<typeof StaffSchema>;
export type ShiftClassInferred = z.infer<typeof ShiftClassSchema>;
export type ShiftPreferenceDetailInferred = z.infer<typeof ShiftPreferenceDetailSchema>;
export type ShiftPreferenceInferred = z.infer<typeof ShiftPreferenceSchema>;
export type ShiftInferred = z.infer<typeof ShiftSchema>;
export type ShiftSnapshotMetadataInferred = z.infer<typeof ShiftSnapshotMetadataSchema>;
export type ShiftTimePatternInferred = z.infer<typeof ShiftTimePatternSchema>;
export type DynamicRoleInferred = z.infer<typeof DynamicRoleSchema>;
export type ShiftRequirementInferred = z.infer<typeof ShiftRequirementSchema>;
export type HolidayInferred = z.infer<typeof HolidaySchema>;
export type BusinessHoursInferred = z.infer<typeof BusinessHoursSchema>;
export type BreakSettingsInferred = z.infer<typeof BreakSettingsSchema>;
export type SchedulePreferencesInferred = z.infer<typeof SchedulePreferencesSchema>;
export type RotationSettingsInferred = z.infer<typeof RotationSettingsSchema>;
export type AuditLogInferred = z.infer<typeof AuditLogSchema>;
