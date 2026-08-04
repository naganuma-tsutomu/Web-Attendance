import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createBusinessDayOverride, createBusinessDayOverridesBulk, deleteBusinessDayOverride,
    getBusinessDayOverrides, getHolidays, updateBusinessDayOverride,
} from '../api';
import type { BusinessDayOverride } from '../../types';
import { QUERY_KEYS } from './queryKeys';

export const useHolidays = (year: number) => useQuery({
    queryKey: QUERY_KEYS.holidays(year),
    queryFn: () => getHolidays(year),
});

export const useBusinessDayOverrides = (yearMonth: string) => useQuery({
    queryKey: QUERY_KEYS.businessDayOverrides(yearMonth),
    queryFn: () => getBusinessDayOverrides(yearMonth),
});

export const useCreateBusinessDayOverride = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<BusinessDayOverride, 'id' | 'created_at' | 'updated_at'>) => createBusinessDayOverride(data),
        onSuccess: (_, data) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.businessDayOverrides(data.date.slice(0, 7)) }),
    });
};

export const useCreateBusinessDayOverridesBulk = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createBusinessDayOverridesBulk,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['businessDayOverrides'] }),
    });
};

export const useUpdateBusinessDayOverride = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Pick<BusinessDayOverride, 'status' | 'name'>; yearMonth: string }) => updateBusinessDayOverride(id, data),
        onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.businessDayOverrides(variables.yearMonth) }),
    });
};

export const useDeleteBusinessDayOverride = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: string; yearMonth: string }) => deleteBusinessDayOverride(id),
        onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.businessDayOverrides(variables.yearMonth) }),
    });
};
