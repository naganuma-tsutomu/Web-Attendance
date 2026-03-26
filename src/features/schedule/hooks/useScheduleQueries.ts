import { useMemo } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useQueries } from '@tanstack/react-query';
import { getShiftsByMonth, getPreferencesByMonth, getFixedDates } from '../../../lib/api';
import { QUERY_KEYS } from '../../../lib/hooks';
import { getWeekStartsOn } from '../../../utils/dateUtils';
import type { Shift, ShiftPreference } from '../../../types';

export const useScheduleQueries = (currentDate: Date, view: View) => {
    const monthsToFetch = useMemo(() => {
        const months = new Set<string>();
        months.add(format(currentDate, 'yyyy-MM'));

        if (view === Views.WEEK) {
            const weekStart = startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() });
            const weekEnd = addDays(weekStart, 6);
            months.add(format(weekStart, 'yyyy-MM'));
            months.add(format(weekEnd, 'yyyy-MM'));
        } else if (view === Views.MONTH) {
            const mStart = startOfMonth(currentDate);
            const mEnd = endOfMonth(currentDate);
            const weekStartOfFirstDay = startOfWeek(mStart, { locale: ja, weekStartsOn: getWeekStartsOn() });
            const weekEndOfLastDay = addDays(startOfWeek(mEnd, { locale: ja, weekStartsOn: getWeekStartsOn() }), 6);
            months.add(format(weekStartOfFirstDay, 'yyyy-MM'));
            months.add(format(weekEndOfLastDay, 'yyyy-MM'));
        }
        return Array.from(months);
    }, [currentDate, view]);

    const shiftQueries = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.shifts(month),
            queryFn: () => getShiftsByMonth(month),
        }))
    });

    const prefQueries = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.preferences(month),
            queryFn: () => getPreferencesByMonth(month),
        }))
    });

    const fixedDatesQueries = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.fixedDates(month),
            queryFn: () => getFixedDates(month),
        }))
    });

    const rawShifts = useMemo(() => {
        const result: Shift[] = [];
        const seen = new Set<string>();
        for (const q of shiftQueries) {
            if (!q.data) continue;
            for (const item of q.data) {
                if (!seen.has(item.id)) {
                    seen.add(item.id);
                    result.push(item);
                }
            }
        }
        return result;
    }, [shiftQueries]);

    const preferences = useMemo(() => {
        const result: ShiftPreference[] = [];
        const seen = new Set<string>();
        for (const q of prefQueries) {
            if (!q.data) continue;
            for (const item of q.data) {
                if (!seen.has(item.id)) {
                    seen.add(item.id);
                    result.push(item);
                }
            }
        }
        return result;
    }, [prefQueries]);

    const fixedDates = useMemo(() => {
        const result = new Set<string>();
        for (const q of fixedDatesQueries) {
            if (!q.data) continue;
            for (const item of q.data) {
                result.add(item);
            }
        }
        return result;
    }, [fixedDatesQueries]);

    const isFetching = shiftQueries.some(q => q.isLoading) || prefQueries.some(q => q.isLoading) || fixedDatesQueries.some(q => q.isLoading);
    const isError = shiftQueries.some(q => q.isError) || prefQueries.some(q => q.isError);

    const refetch = () => {
        shiftQueries.forEach(q => q.refetch());
        prefQueries.forEach(q => q.refetch());
    };

    return { rawShifts, preferences, fixedDates, isFetching, isError, refetch };
};
