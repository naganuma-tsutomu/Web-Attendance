import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getStaffList, updateStaff, createStaff, deleteStaff, updateStaffOrder,
    getRoles, getClasses, getShiftsByMonth, getTimePatterns, getHolidays,
    getPreferencesByMonth, getShiftRequirements, saveShiftsBatch, replaceShiftsForMonth,
    updateShift, deleteShiftsByMonth, saveFixedDates, savePreference, updatePreferenceSubmitted,
    getBusinessHours, updateBusinessHours,
    getExcelSettings, updateExcelSettings,
    getSchedulePreferences, updateSchedulePreferences,
    getFacilityName, updateFacilityName,
    getRotationSettings, updateRotationSettings,
    getBreakSettings, updateBreakSettings,
    getShiftSnapshots, createShiftSnapshot, restoreShiftSnapshot,
    getShiftRequirementTemplates, toggleFixedDate
} from './api';
import type { Staff, Shift, ShiftPreference, BusinessHours, ExcelSettings, SchedulePreferences, RotationSettings, BreakSettings } from '../types';

// クエリキーの定数化
export const QUERY_KEYS = {
    staffs: ['staffs'],
    roles: ['roles'],
    classes: ['classes'],
    shifts: (monthStr: string) => ['shifts', monthStr],
    shiftSnapshots: (monthStr: string) => ['shiftSnapshots', monthStr],
    timePatterns: ['timePatterns'],
    holidays: (year: number) => ['holidays', year],
    preferences: (monthStr: string) => ['preferences', monthStr],
    shiftRequirements: ['shiftRequirements'],
    shiftRequirementTemplates: ['shiftRequirementTemplates'],
    fixedDates: (monthStr: string) => ['fixedDates', monthStr],
    businessHours: ['businessHours'],
    facilityName: ['facilityName'],
    excelSettings: ['excelSettings'],
    schedulePreferences: ['schedulePreferences'],
    rotationSettings: ['rotationSettings'],
    breakSettings: ['breakSettings'],
};

// ==============================
// Queries (データ取得)
// ==============================

export const useStaffList = () => {
    return useQuery({
        queryKey: QUERY_KEYS.staffs,
        queryFn: getStaffList,
    });
};

export const useRoles = () => {
    return useQuery({
        queryKey: QUERY_KEYS.roles,
        queryFn: getRoles,
    });
};

export const useClasses = () => {
    return useQuery({
        queryKey: QUERY_KEYS.classes,
        queryFn: getClasses,
    });
};

export const useShiftsByMonth = (monthStr: string) => {
    return useQuery({
        queryKey: QUERY_KEYS.shifts(monthStr),
        queryFn: () => getShiftsByMonth(monthStr),
    });
};

export const useShiftSnapshots = (monthStr: string) => {
    return useQuery({
        queryKey: QUERY_KEYS.shiftSnapshots(monthStr),
        queryFn: () => getShiftSnapshots(monthStr),
    });
};

export const useTimePatterns = () => {
    return useQuery({
        queryKey: QUERY_KEYS.timePatterns,
        queryFn: getTimePatterns,
    });
};

export const useHolidays = (year: number) => {
    return useQuery({
        queryKey: QUERY_KEYS.holidays(year),
        queryFn: () => getHolidays(year),
    });
};

export const usePreferencesByMonth = (monthStr: string) => {
    return useQuery({
        queryKey: QUERY_KEYS.preferences(monthStr),
        queryFn: () => getPreferencesByMonth(monthStr),
    });
};

export const useShiftRequirements = () => {
    return useQuery({
        queryKey: QUERY_KEYS.shiftRequirements,
        queryFn: getShiftRequirements,
    });
};

export const useShiftRequirementTemplates = () => {
    return useQuery({
        queryKey: QUERY_KEYS.shiftRequirementTemplates,
        queryFn: getShiftRequirementTemplates,
    });
};

// ==============================
// Mutations (データ更新)
// ==============================

export const useCreateStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newStaff: Omit<Staff, 'id'>) => createStaff(newStaff),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs });
        },
    });
};

export const useUpdateStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Staff> }) => updateStaff(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs });
        },
    });
};

export const useDeleteStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteStaff(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs });
        },
    });
};

export const useUpdateStaffOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (orders: { id: string, order: number }[]) => updateStaffOrder(orders),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs });
        },
    });
};

// Schedule Mutations
// useSaveShiftsBatch: 単発シフト追加用 (POST /shifts)。ShiftEditModal 経由の1件追加で使用。
// useReplaceShiftsForMonth: 月次一括置換用 (POST /shifts/replace)。自動生成時に月全体を原子的に置換。
export const useSaveShiftsBatch = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (shifts: Omit<Shift, 'id'>[]) => saveShiftsBatch(shifts),
        onSuccess: () => {
            // シフトデータ全体を再取得させるためプレフィックスで invalidate
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
    });
};

export const useReplaceShiftsForMonth = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, shifts, fixedDates }: { yearMonth: string; shifts: Omit<Shift, 'id'>[]; fixedDates?: string[] }) =>
            replaceShiftsForMonth(yearMonth, shifts, fixedDates ?? []),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
    });
};

export const useUpdateShift = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Shift> }) => updateShift(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
    });
};

export const useDeleteShiftsByMonth = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, exceptDates }: { yearMonth: string, exceptDates?: string[] }) => deleteShiftsByMonth(yearMonth, exceptDates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
    });
};

export const useSaveFixedDates = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, dates }: { yearMonth: string, dates: string[] }) => saveFixedDates(yearMonth, dates),
        onSuccess: (_, { yearMonth }) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedDates(yearMonth) });
        },
    });
};

export const useToggleFixedDate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ date, fixed }: { date: string; fixed: boolean }) => toggleFixedDate(date, fixed),
        scope: { id: 'toggle-fixed-date' },
        onMutate: async ({ date, fixed }) => {
            const yearMonth = date.slice(0, 7);
            const queryKey = QUERY_KEYS.fixedDates(yearMonth);
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<string[]>(queryKey);
            const next = new Set(previous ?? []);
            if (fixed) next.add(date);
            else next.delete(date);
            queryClient.setQueryData(queryKey, Array.from(next).sort());
            return { previous, queryKey };
        },
        onError: (_error, _variables, context) => {
            if (context) queryClient.setQueryData(context.queryKey, context.previous);
        },
        onSettled: (_data, _error, { date }) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedDates(date.slice(0, 7)) });
        },
    });
};

export const useCreateShiftSnapshot = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, reason, label }: { yearMonth: string; reason: string; label?: string | null }) =>
            createShiftSnapshot(yearMonth, reason, label),
        onSuccess: (_, { yearMonth }) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftSnapshots(yearMonth) });
        },
    });
};

export const useRestoreShiftSnapshot = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: string }) => restoreShiftSnapshot(id),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedDates(result.yearMonth) });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftSnapshots(result.yearMonth) });
        },
    });
};

export const useSavePreference = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<ShiftPreference, 'id'>) => savePreference(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.preferences(variables.yearMonth) });
        },
    });
};

export const useUpdatePreferenceSubmitted = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ staffId, yearMonth, submitted }: { staffId: string; yearMonth: string; submitted: boolean }) =>
            updatePreferenceSubmitted(staffId, yearMonth, submitted),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.preferences(variables.yearMonth) });
        },
    });
};

// ==============================
// Business Hours (営業時間設定)
// ==============================

export const useBusinessHours = () => {
    return useQuery({
        queryKey: QUERY_KEYS.businessHours,
        queryFn: getBusinessHours,
        staleTime: 30 * 60 * 1000, // 30分間キャッシュ
    });
};

export const useUpdateBusinessHours = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: BusinessHours) => updateBusinessHours(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.businessHours });
        },
    });
};

// ==============================
// Excel Settings (Excel出力設定)
// ==============================

export const useExcelSettings = () => {
    return useQuery({
        queryKey: QUERY_KEYS.excelSettings,
        queryFn: getExcelSettings,
    });
};

export const useUpdateExcelSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: ExcelSettings) => updateExcelSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.excelSettings });
        },
    });
};

// ==============================
// Schedule Preferences (シフト画面設定)
// ==============================

export const useSchedulePreferences = () => {
    return useQuery({
        queryKey: QUERY_KEYS.schedulePreferences,
        queryFn: getSchedulePreferences,
        staleTime: 30 * 60 * 1000,
    });
};

export const useUpdateSchedulePreferences = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: SchedulePreferences) => updateSchedulePreferences(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedulePreferences });
        },
    });
};

// ==============================
// Facility Name (施設名設定)
// ==============================

export const useFacilityName = () => {
    return useQuery({
        queryKey: QUERY_KEYS.facilityName,
        queryFn: getFacilityName,
        staleTime: 30 * 60 * 1000,
    });
};

export const useUpdateFacilityName = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (name: string) => updateFacilityName(name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.facilityName });
        },
    });
};

// ==============================
// Rotation Settings (ローテーション設定)
// ==============================

export const useRotationSettings = () => {
    return useQuery({
        queryKey: QUERY_KEYS.rotationSettings,
        queryFn: getRotationSettings,
        staleTime: 30 * 60 * 1000,
    });
};

export const useUpdateRotationSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: RotationSettings) => updateRotationSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rotationSettings });
        },
    });
};

// ==============================
// Break Settings (休憩設定)
// ==============================

export const useBreakSettings = () => {
    return useQuery({
        queryKey: QUERY_KEYS.breakSettings,
        queryFn: getBreakSettings,
        staleTime: 30 * 60 * 1000,
    });
};

export const useUpdateBreakSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: BreakSettings) => updateBreakSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.breakSettings });
        },
    });
};
