import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPreferencesByMonth, savePreference, updatePreferenceSubmitted } from '../api';
import type { ShiftPreference } from '../../types';
import { QUERY_KEYS } from './queryKeys';

export const usePreferencesByMonth = (monthStr: string) => useQuery({
    queryKey: QUERY_KEYS.preferences(monthStr),
    queryFn: () => getPreferencesByMonth(monthStr),
});

export const useSavePreference = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Omit<ShiftPreference, 'id'>) => savePreference(data),
        onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.preferences(variables.yearMonth) }),
    });
};

export const useUpdatePreferenceSubmitted = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ staffId, yearMonth, submitted }: { staffId: string; yearMonth: string; submitted: boolean }) =>
            updatePreferenceSubmitted(staffId, yearMonth, submitted),
        onSuccess: (_, variables) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.preferences(variables.yearMonth) }),
    });
};
