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
    useSchedulePreferences,
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

    // 静的データ
    const { data: staffList = [], isLoading: isLoadingStaff } = useStaffList();
    const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
    const { data: timePatterns = [], isLoading: isLoadingPatterns } = useTimePatterns();
    const { data: roles = [], isLoading: isLoadingRoles } = useRoles();
    const { data: businessHours } = useBusinessHours();
    const { data: excelSettings } = useExcelSettings();
    const { data: breakSettings } = useBreakSettings();
    const { data: schedulePreferences } = useSchedulePreferences();

    // 動的な複数月データフェッチ
    const { rawShifts, preferences, fixedDates, monthsToFetch, isFetching, isError, refetch } = useScheduleQueries(currentDate, view);
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

    const getBusinessDayStatusForDate = (date: Date): 'open' | 'closed' | null => {
        const override = businessDayOverrideMap.get(format(date, 'yyyy-MM-dd'));
        return override?.status ?? null;
    };

    // Loading & Error States
    const loading = isLoadingStaff || isLoadingClasses || isLoadingPatterns || isLoadingRoles || isLoadingHolidays || isLoadingBusinessDayOverrides;
    const loadError = isError || hasBusinessDayQueryError ? 'データの読み込みに失敗しました。' : null;

    // 変更ハンドラ群（生成・消去・更新・固定日切り替え）
    const actions = useScheduleActions({
        currentDate,
        targetYearMonth,
        fixedDates,
        rawShifts,
        classes,
        autoOpenGenerationReport: schedulePreferences?.autoOpenGenerationReport ?? true,
    });

    useEffect(() => {
        syncHolidaysIfNeeded().catch(err => console.error('Failed to sync holidays', err));
    }, []);

    useEffect(() => {
        saveActiveMonth(currentDate);
    }, [currentDate]);

    const loadShifts = () => refetch();

    return {
        // データ
        events,
        rawShifts,
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
        summaryEvents,

        // UI状態
        loading,
        isFetching,
        errorCount,
        errorDates,
        loadError,
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
        eventStyleGetter,
        getHolidayNameForDate,
        getBusinessDayStatusForDate,
        isHolidayDate,

        // 変更ハンドラ群（useScheduleActions から）
        ...actions,
    };
};
