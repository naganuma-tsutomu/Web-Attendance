import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createShiftSnapshot, deleteShiftsByDateRange, deleteShiftsByMonth, getShiftSnapshots,
    getShiftsByMonth, replaceShiftsForMonth, restoreShiftSnapshot, saveFixedDates,
    saveShiftsBatch, toggleFixedDate, updateShift,
} from '../api';
import type { Shift } from '../../types';
import { QUERY_KEYS } from './queryKeys';

export const useShiftsByMonth = (monthStr: string) => useQuery({
    queryKey: QUERY_KEYS.shifts(monthStr), queryFn: () => getShiftsByMonth(monthStr),
    select: data => data.shifts,
});

export const useShiftSnapshots = (monthStr: string) => useQuery({
    queryKey: QUERY_KEYS.shiftSnapshots(monthStr), queryFn: () => getShiftSnapshots(monthStr),
});

export const useSaveShiftsBatch = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (shifts: Omit<Shift, 'id'>[]) => saveShiftsBatch(shifts),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
    });
};

export const useReplaceShiftsForMonth = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, shifts, fixedDates, expectedVersion }: { yearMonth: string; shifts: Omit<Shift, 'id'>[]; fixedDates?: string[]; expectedVersion?: number }) => {
            const monthData = queryClient.getQueryData<{ shifts: Shift[]; version: number }>(QUERY_KEYS.shifts(yearMonth));
            const version = expectedVersion ?? monthData?.version;
            if (version === undefined) throw new Error('シフトを再読み込みしてから保存してください');
            return replaceShiftsForMonth(yearMonth, version, shifts, fixedDates ?? []);
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
    });
};

export const useDeleteShiftsByDateRange = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) => deleteShiftsByDateRange(startDate, endDate),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
    });
};

export const useUpdateShift = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Shift> }) => updateShift(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
    });
};

export const useDeleteShiftsByMonth = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, exceptDates, clearFixedDates }: { yearMonth: string; exceptDates?: string[]; clearFixedDates?: boolean }) =>
            deleteShiftsByMonth(yearMonth, exceptDates, clearFixedDates),
        onSuccess: (_, { yearMonth, clearFixedDates }) => {
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            if (clearFixedDates) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedDates(yearMonth) });
        },
    });
};

export const useSaveFixedDates = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ yearMonth, dates }: { yearMonth: string; dates: string[] }) => saveFixedDates(yearMonth, dates),
        onSuccess: (_, { yearMonth }) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fixedDates(yearMonth) }),
    });
};

export const useToggleFixedDate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ date, fixed }: { date: string; fixed: boolean }) => toggleFixedDate(date, fixed),
        scope: { id: 'toggle-fixed-date' },
        onMutate: async ({ date, fixed }) => {
            const queryKey = QUERY_KEYS.fixedDates(date.slice(0, 7));
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<string[]>(queryKey);
            const next = new Set(previous ?? []);
            if (fixed) next.add(date); else next.delete(date);
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
        onSuccess: (_, { yearMonth }) => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.shiftSnapshots(yearMonth) }),
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
