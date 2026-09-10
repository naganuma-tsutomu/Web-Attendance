import { useState, useEffect, useMemo, useRef } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format } from 'date-fns';
import { useQueries } from '@tanstack/react-query';
import {
    getBusinessDayOverrides, getHolidays, syncHolidaysIfNeeded,
} from '../../../lib/api';
import {
    QUERY_KEYS, useStaffList, useClasses, useTimePatterns, useRoles,
    useBusinessHours, useExcelSettings, useBreakSettings,
    useSchedulePreferences, useShiftRequirements,
} from '../../../lib/hooks';
import { createBusinessDayOverrideMap, resolveBusinessDay } from '../../../lib/businessDayUtils';
import { saveActiveMonth, loadActiveMonth } from '../../../utils/dateUtils';
import { useScheduleQueries } from './useScheduleQueries';
import { useCalendarEvents } from './useCalendarEvents';
import { useScheduleActions } from './useScheduleActions';

export type { CalendarEvent } from './useCalendarEvents';

// 編集フォームの型定義
export interface EditFormData {
    staffId: string;
    date: string;
    startTime: string;
    endTime: string;
}

export const useScheduleData = () => {
    const [currentDate, setCurrentDate] = useState(() => loadActiveMonth());
    const [view, setView] = useState<View>(Views.MONTH);
    const targetYearMonth = format(currentDate, 'yyyy-MM');

    // UI State
    const [isDayModified, setIsDayModified] = useState(false);
    const daySaveRef = useRef<(() => Promise<void>) | null>(null);
    const dayDiscardRef = useRef<(() => void) | null>(null);
    const holidaySyncStartedRef = useRef(false);

    // 静的データ
    const staffQuery = useStaffList();
    const classesQuery = useClasses();
    const timePatternsQuery = useTimePatterns();
    const rolesQuery = useRoles();
    const businessHoursQuery = useBusinessHours();
    const excelSettingsQuery = useExcelSettings();
    const breakSettingsQuery = useBreakSettings();
    const schedulePreferencesQuery = useSchedulePreferences();
    const requirementsQuery = useShiftRequirements();
    const { data: staffList = [] } = staffQuery;
    const { data: classes = [] } = classesQuery;
    const { data: timePatterns = [] } = timePatternsQuery;
    const { data: roles = [] } = rolesQuery;
    const { data: businessHours } = businessHoursQuery;
    const { data: excelSettings } = excelSettingsQuery;
    const { data: breakSettings } = breakSettingsQuery;
    const { data: schedulePreferences } = schedulePreferencesQuery;
    const { data: requirements = [] } = requirementsQuery;

    // 動的な複数月データフェッチ
    const {
        rawShifts, shiftMonthVersions, preferences, fixedDates, monthsToFetch,
        isFetching: isFetchingMonthlyData, isError, refetch,
    } = useScheduleQueries(currentDate, view);
    const yearsToFetch = useMemo(() => Array.from(new Set(monthsToFetch.map(month => Number(month.slice(0, 4))))), [monthsToFetch]);

    const holidayQueries = useQueries({
        queries: yearsToFetch.map(year => ({
            queryKey: QUERY_KEYS.holidays(year),
            queryFn: () => getHolidays(year),
        })),
    });
    const overrideQueries = useQueries({
        queries: monthsToFetch.map(month => ({
            queryKey: QUERY_KEYS.businessDayOverrides(month),
            queryFn: () => getBusinessDayOverrides(month),
        })),
    });
    const holidays = useMemo(() => holidayQueries.flatMap(query => query.data ?? []), [holidayQueries]);
    const businessDayOverrides = useMemo(() => overrideQueries.flatMap(query => query.data ?? []), [overrideQueries]);
    const isLoadingHolidays = holidayQueries.some(query => query.isLoading);
    const isLoadingBusinessDayOverrides = overrideQueries.some(query => query.isLoading);
    const hasBusinessDayQueryError = holidayQueries.some(query => query.isError) || overrideQueries.some(query => query.isError);

    // カレンダーイベント構築
    const { events, summaryEvents, errorCount, errorDates, eventStyleGetter } = useCalendarEvents(
        rawShifts, staffList, classes, preferences, currentDate, view, targetYearMonth, businessHours,
        holidays, businessDayOverrides
    );

    // 祝日マップ
    const holidayMap = useMemo(() => new Map(holidays.map(h => [h.date, h])), [holidays]);
    const businessDayOverrideMap = useMemo(() => createBusinessDayOverrideMap(businessDayOverrides), [businessDayOverrides]);

    const resolveDate = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return resolveBusinessDay({
            date, dateStr,
            closedDays: businessHours?.closedDays ?? [],
            holiday: holidayMap.get(dateStr),
            override: businessDayOverrideMap.get(dateStr),
        });
    };

    const getHolidayNameForDate = (date: Date): string => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const resolution = resolveDate(date);
        const override = businessDayOverrideMap.get(dateStr);
        const label = override
            ? override.name
            : holidayMap.get(dateStr)?.name || (resolution.reason === 'weekly_closed' ? '固定休' : resolution.label || '');
        const shiftCount = rawShifts.filter(shift => shift.date === dateStr).length;
        return !resolution.isOpen && shiftCount > 0
            ? `${label || '休業'}（シフト${shiftCount}件あり）`
            : label;
    };

    const isHolidayDate = (date: Date): boolean => {
        return !resolveDate(date).isOpen;
    };

    const isNationalHolidayDate = (date: Date): boolean => {
        const holiday = holidayMap.get(format(date, 'yyyy-MM-dd'));
        return !!holiday && !holiday.isWorkday;
    };

    const getBusinessDayStatusForDate = (date: Date): 'open' | 'closed' | null => {
        const override = businessDayOverrideMap.get(format(date, 'yyyy-MM-dd'));
        return override?.status ?? null;
    };

    // Loading & Error States
    const referenceQueries = [
        staffQuery,
        classesQuery,
        timePatternsQuery,
        rolesQuery,
        businessHoursQuery,
        excelSettingsQuery,
        breakSettingsQuery,
        schedulePreferencesQuery,
        requirementsQuery,
    ];
    const isLoadingReferenceData = referenceQueries.some(query => query.isLoading);
    const isFetchingReferenceData = referenceQueries.some(query => query.isFetching);
    const hasReferenceQueryError = referenceQueries.some(query => query.isError);
    const loading = isLoadingReferenceData || isLoadingHolidays || isLoadingBusinessDayOverrides;
    const isFetching = isFetchingMonthlyData
        || isFetchingReferenceData
        || holidayQueries.some(query => query.isFetching)
        || overrideQueries.some(query => query.isFetching);
    const loadError = isError || hasReferenceQueryError || hasBusinessDayQueryError
        ? 'データの読み込みに失敗しました。再読み込みが完了するまで編集・生成・消去はできません。'
        : null;
    const canMutateSchedule = !loading && !loadError;

    // 変更ハンドラ群（生成・消去・更新・固定日切り替え）
    const actions = useScheduleActions({
        currentDate,
        targetYearMonth,
        fixedDates,
        rawShifts,
        classes,
        autoOpenGenerationReport: schedulePreferences?.autoOpenGenerationReport ?? true,
        canMutateSchedule,
    });

    useEffect(() => {
        if (loading || loadError || holidaySyncStartedRef.current) return;
        // 初期表示に必要なGET群が完了してから、日次同期をバックグラウンドで始める。
        const timer = window.setTimeout(() => {
            holidaySyncStartedRef.current = true;
            syncHolidaysIfNeeded().catch(err => console.error('Failed to sync holidays', err));
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [loading, loadError]);

    useEffect(() => {
        saveActiveMonth(currentDate);
    }, [currentDate]);

    const loadShifts = () => {
        void refetch();
    };

    const retryLoad = () => {
        void Promise.all([
            refetch(),
            ...referenceQueries.map(query => query.refetch()),
            ...holidayQueries.map(query => query.refetch()),
            ...overrideQueries.map(query => query.refetch()),
        ]);
    };

    return {
        // データ
        events,
        rawShifts,
        shiftMonthVersions,
        staffList,
        classes,
        timePatterns,
        preferences,
        roles,
        fixedDates,
        holidays,
        businessDayOverrides,
        businessHours,
        excelSettings,
        breakSettings,
        requirements,
        summaryEvents,

        // UI状態
        loading,
        isFetching,
        errorCount,
        errorDates,
        loadError,
        canMutateSchedule,
        currentDate,
        view,
        isDayModified,
        daySaveRef,
        dayDiscardRef,

        // 派生値
        targetYearMonth,
        holidayMap,

        // アクション
        setCurrentDate,
        setView,
        setIsDayModified,
        loadShifts,
        retryLoad,
        eventStyleGetter,
        getHolidayNameForDate,
        getBusinessDayStatusForDate,
        isHolidayDate,
        isNationalHolidayDate,

        // 変更ハンドラ群（useScheduleActions から）
        ...actions,
    };
};
