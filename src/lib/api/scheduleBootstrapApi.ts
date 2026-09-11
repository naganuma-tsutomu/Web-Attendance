import { z } from 'zod';
import type {
    BreakSettings,
    BusinessDayOverride,
    BusinessHours,
    DynamicRole,
    ExcelSettings,
    Holiday,
    SchedulePreferences,
    Shift,
    ShiftClass,
    ShiftPreference,
    ShiftRequirement,
    ShiftTimePattern,
    Staff,
} from '../../types';
import {
    BreakSettingsSchema,
    BusinessDayOverrideSchema,
    BusinessHoursSchema,
    DynamicRoleSchema,
    ExcelSettingsSchema,
    HolidaySchema,
    SchedulePreferencesSchema,
    ShiftClassSchema,
    ShiftPreferenceSchema,
    ShiftRequirementSchema,
    ShiftSchema,
    ShiftTimePatternSchema,
    StaffSchema,
} from '../../types/schemas';
import { apiFetch } from '../apiClient';

const ShiftMonthDataSchema = z.object({
    shifts: z.array(ShiftSchema),
    version: z.number().int().nonnegative(),
});

export const ScheduleBootstrapSchema = z.object({
    references: z.object({
        staffs: z.array(StaffSchema),
        classes: z.array(ShiftClassSchema),
        timePatterns: z.array(ShiftTimePatternSchema),
        roles: z.array(DynamicRoleSchema),
        businessHours: BusinessHoursSchema,
        excelSettings: ExcelSettingsSchema,
        breakSettings: BreakSettingsSchema,
        schedulePreferences: SchedulePreferencesSchema,
        shiftRequirements: z.array(ShiftRequirementSchema),
    }),
    months: z.record(z.string(), z.object({
        shifts: ShiftMonthDataSchema,
        preferences: z.array(ShiftPreferenceSchema),
        fixedDates: z.array(z.string()),
        businessDayOverrides: z.array(BusinessDayOverrideSchema),
    })),
    holidays: z.record(z.string(), z.array(HolidaySchema)),
});

export interface ScheduleBootstrapData {
    references: {
        staffs: Staff[];
        classes: ShiftClass[];
        timePatterns: ShiftTimePattern[];
        roles: DynamicRole[];
        businessHours: BusinessHours;
        excelSettings: ExcelSettings;
        breakSettings: BreakSettings;
        schedulePreferences: SchedulePreferences;
        shiftRequirements: ShiftRequirement[];
    };
    months: Record<string, {
        shifts: { shifts: Shift[]; version: number };
        preferences: ShiftPreference[];
        fixedDates: string[];
        businessDayOverrides: BusinessDayOverride[];
    }>;
    holidays: Record<string, Holiday[]>;
}

export const getScheduleBootstrap = async (months: string[]): Promise<ScheduleBootstrapData> => {
    const params = new URLSearchParams();
    for (const month of months) params.append('month', month);

    const data = await apiFetch<ScheduleBootstrapData>(
        `/schedule-bootstrap?${params.toString()}`,
        {},
        ScheduleBootstrapSchema,
    );

    for (const month of months) {
        if (!data.months[month]) throw new Error(`${month}のスケジュールデータが不足しています`);
    }
    const years = new Set(months.map(month => month.slice(0, 4)));
    for (const year of years) {
        if (!data.holidays[year]) throw new Error(`${year}年の祝日データが不足しています`);
    }

    return data;
};
