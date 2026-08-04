import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createStaff, deleteStaff, getStaffList, updateStaff, updateStaffOrder } from '../api';
import type { Staff } from '../../types';
import { QUERY_KEYS } from './queryKeys';

export const useStaffList = () => useQuery({ queryKey: QUERY_KEYS.staffs, queryFn: getStaffList });

export const useCreateStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newStaff: Omit<Staff, 'id'>) => createStaff(newStaff),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs }); },
    });
};

export const useUpdateStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Staff> }) => updateStaff(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs }); },
    });
};

export const useDeleteStaff = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteStaff(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs }); },
    });
};

export const useUpdateStaffOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (orders: { id: string; order: number }[]) => updateStaffOrder(orders),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffs }); },
    });
};
