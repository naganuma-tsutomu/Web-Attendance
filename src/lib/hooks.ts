import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getStaffList, updateStaff, createStaff, deleteStaff, updateStaffOrder,
    getRoles, getClasses, getShiftsByMonth, getTimePatterns, getHolidays,
    getPreferencesByMonth, getShiftRequirements, getFixedDates, saveShiftsBatch,
    updateShift, deleteShiftsByMonth, saveFixedDates, savePreference
} from './api';
import type { Staff, Shift, ShiftPreference } from '../types';

// クエリキーの定数化
export const QUERY_KEYS = {
    staffs: ['staffs'],
    roles: ['roles'],
    classes: ['classes'],
    shifts: (monthStr: string) => ['shifts', monthStr],
    timePatterns: ['timePatterns'],
    holidays: (year: number) => ['holidays', year],
    preferences: (monthStr: string) => ['preferences', monthStr],
    shiftRequirements: ['shiftRequirements'],
    fixedDates: (monthStr: string) => ['fixedDates', monthStr],
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

export const useFixedDates = (monthStr: string) => {
    return useQuery({
        queryKey: QUERY_KEYS.fixedDates(monthStr),
        queryFn: () => getFixedDates(monthStr),
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

export const useSavePreference = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<ShiftPreference, 'id'>) => savePreference(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.preferences(variables.yearMonth) });
        },
    });
};

