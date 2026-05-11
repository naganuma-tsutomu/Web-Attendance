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

    const { rawShifts, isFetchingShifts, isErrorShifts, refetchShifts } = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.shifts(month),
            queryFn: () => getShiftsByMonth(month),
        })),
        combine: (results) => {
            const seen = new Set<string>();
            const rawShifts: Shift[] = [];
            for (const q of results) {
                if (!q.data) continue;
                for (const item of q.data) {
                    if (!seen.has(item.id)) {
                        seen.add(item.id);
                        rawShifts.push(item);
                    }
                }
            }
            return {
                rawShifts,
                isFetchingShifts: results.some(q => q.isFetching),
                isErrorShifts: results.some(q => q.isError),
                refetchShifts: () => results.forEach(q => q.refetch()),
            };
        },
    });

    const { preferences, isFetchingPrefs, isErrorPrefs } = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.preferences(month),
            queryFn: () => getPreferencesByMonth(month),
        })),
        combine: (results) => {
            const seen = new Set<string>();
            const preferences: ShiftPreference[] = [];
            for (const q of results) {
                if (!q.data) continue;
                for (const item of q.data) {
                    if (!seen.has(item.id)) {
                        seen.add(item.id);
                        preferences.push(item);
                    }
                }
            }
            return {
                preferences,
                isFetchingPrefs: results.some(q => q.isFetching),
                isErrorPrefs: results.some(q => q.isError),
            };
        },
    });

    const { fixedDates, isFetchingFixed } = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.fixedDates(month),
            queryFn: () => getFixedDates(month),
        })),
        combine: (results) => {
            const fixedDates = new Set<string>();
            for (const q of results) {
                if (!q.data) continue;
                for (const item of q.data) {
                    fixedDates.add(item);
                }
            }
            return {
                fixedDates,
                isFetchingFixed: results.some(q => q.isFetching),
            };
        },
    });

    const isFetching = isFetchingShifts || isFetchingPrefs || isFetchingFixed;
    const isError = isErrorShifts || isErrorPrefs;

    return { rawShifts, preferences, fixedDates, isFetching, isError, refetch: refetchShifts };
};
