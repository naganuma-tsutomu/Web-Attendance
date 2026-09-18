import { useState, useEffect, useMemo, useRef } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format } from 'date-fns';
import { syncHolidaysIfNeeded } from '../../../lib/api';
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

    // 初期表示に必要な参照データ・複数月データを1リクエストで取得
    const {
        rawShifts, shiftMonthVersions, preferences, fixedDates, holidays, businessDayOverrides,
        references, isLoading: loading, isFetching, isError, refetch,
    } = useScheduleQueries(currentDate, view);
    const staffList = references?.staffs ?? [];
    const classes = references?.classes ?? [];
    const timePatterns = references?.timePatterns ?? [];
    const roles = references?.roles ?? [];
    const businessHours = references?.businessHours;
    const excelSettings = references?.excelSettings;
    const breakSettings = references?.breakSettings;
    const schedulePreferences = references?.schedulePreferences;
    const requirements = references?.shiftRequirements ?? [];

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
    const loadError = isError
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
        void refetch();
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
