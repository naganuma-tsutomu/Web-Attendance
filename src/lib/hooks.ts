import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaffList, updateStaff, createStaff, deleteStaff, updateStaffOrder, getRoles, getClasses, getShiftsByMonth } from './api';
import type { Staff } from '../types';

// クエリキーの定数化
export const QUERY_KEYS = {
    staffs: ['staffs'],
    roles: ['roles'],
    classes: ['classes'],
    shifts: (monthStr: string) => ['shifts', monthStr],
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
