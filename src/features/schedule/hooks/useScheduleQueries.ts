import { useMemo } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getScheduleBootstrap, type ScheduleBootstrapData } from '../../../lib/api';
import { QUERY_KEYS } from '../../../lib/hooks';
import { getWeekStartsOn } from '../../../utils/dateUtils';
import type { BusinessDayOverride, Shift, ShiftPreference } from '../../../types';

const hydrateIndividualCaches = (
    queryClient: ReturnType<typeof useQueryClient>,
    data: ScheduleBootstrapData,
) => {
    const references = data.references;
    queryClient.setQueryData(QUERY_KEYS.staffs, references.staffs);
    queryClient.setQueryData(QUERY_KEYS.classes, references.classes);
    queryClient.setQueryData(QUERY_KEYS.timePatterns, references.timePatterns);
    queryClient.setQueryData(QUERY_KEYS.roles, references.roles);
    queryClient.setQueryData(QUERY_KEYS.businessHours, references.businessHours);
    queryClient.setQueryData(QUERY_KEYS.excelSettings, references.excelSettings);
    queryClient.setQueryData(QUERY_KEYS.breakSettings, references.breakSettings);
    queryClient.setQueryData(QUERY_KEYS.schedulePreferences, references.schedulePreferences);
    queryClient.setQueryData(QUERY_KEYS.shiftRequirements, references.shiftRequirements);

    for (const [month, monthData] of Object.entries(data.months)) {
        queryClient.setQueryData(QUERY_KEYS.shifts(month), monthData.shifts);
        queryClient.setQueryData(QUERY_KEYS.preferences(month), monthData.preferences);
        queryClient.setQueryData(QUERY_KEYS.fixedDates(month), monthData.fixedDates);
        queryClient.setQueryData(QUERY_KEYS.businessDayOverrides(month), monthData.businessDayOverrides);
    }
    for (const [year, holidays] of Object.entries(data.holidays)) {
        queryClient.setQueryData(QUERY_KEYS.holidays(Number(year)), holidays);
    }
};

export const useScheduleQueries = (currentDate: Date, view: View) => {
    const queryClient = useQueryClient();
    const monthsToFetch = useMemo(() => {
        const months = new Set<string>();
        months.add(format(currentDate, 'yyyy-MM'));

        if (view === Views.WEEK || view === Views.DAY) {
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

    const query = useQuery({
        queryKey: QUERY_KEYS.scheduleBootstrap(monthsToFetch),
        queryFn: async () => {
            const data = await getScheduleBootstrap(monthsToFetch);
            hydrateIndividualCaches(queryClient, data);
            return data;
        },
        // 他画面で設定を更新して戻った場合も、集約レスポンスを使い回さない。
        staleTime: 0,
    });

    const combined = useMemo(() => {
        const seenShifts = new Set<string>();
        const seenPreferences = new Set<string>();
        const rawShifts: Shift[] = [];
        const preferences: ShiftPreference[] = [];
        const fixedDates = new Set<string>();
        const shiftMonthVersions: Record<string, number> = {};
        const businessDayOverrides: BusinessDayOverride[] = [];

        for (const month of monthsToFetch) {
            const monthData = query.data?.months[month];
            if (!monthData) continue;
            shiftMonthVersions[month] = monthData.shifts.version;
            for (const shift of monthData.shifts.shifts) {
                if (seenShifts.has(shift.id)) continue;
                seenShifts.add(shift.id);
                rawShifts.push(shift);
            }
            for (const preference of monthData.preferences) {
                if (seenPreferences.has(preference.id)) continue;
                seenPreferences.add(preference.id);
                preferences.push(preference);
            }
            for (const date of monthData.fixedDates) fixedDates.add(date);
            businessDayOverrides.push(...monthData.businessDayOverrides);
        }

        const years = Array.from(new Set(monthsToFetch.map(month => month.slice(0, 4))));
        const holidays = years.flatMap(year => query.data?.holidays[year] ?? []);

        return { rawShifts, shiftMonthVersions, preferences, fixedDates, holidays, businessDayOverrides };
    }, [monthsToFetch, query.data]);

    return {
        ...combined,
        monthsToFetch,
        references: query.data?.references,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        refetch: query.refetch,
    };
};
