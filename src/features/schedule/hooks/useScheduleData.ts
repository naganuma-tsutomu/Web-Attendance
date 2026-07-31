import { useState, useEffect, useMemo, useRef } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format } from 'date-fns';
import {
    syncHolidaysIfNeeded,
} from '../../../lib/api';
import {
    useStaffList, useClasses, useTimePatterns, useRoles, useHolidays,
    useBusinessHours, useExcelSettings, useBreakSettings,
    useSchedulePreferences,
} from '../../../lib/hooks';
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
    const { data: holidays = [], isLoading: isLoadingHolidays } = useHolidays(currentDate.getFullYear());
    const { data: businessHours } = useBusinessHours();
    const { data: excelSettings } = useExcelSettings();
    const { data: breakSettings } = useBreakSettings();
    const { data: schedulePreferences } = useSchedulePreferences();

    // 動的な複数月データフェッチ
    const { rawShifts, preferences, fixedDates, isFetching, isError, refetch } = useScheduleQueries(currentDate, view);

    // カレンダーイベント構築
    const { events, summaryEvents, errorCount, errorDates, eventStyleGetter } = useCalendarEvents(
        rawShifts, staffList, classes, preferences, currentDate, view, targetYearMonth, businessHours
    );

    // 祝日マップ
    const holidayMap = useMemo(() => new Map(holidays.map(h => [h.date, h])), [holidays]);

    const getHolidayNameForDate = (date: Date): string => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return holidayMap.get(dateStr)?.name || '';
    };

    const isHolidayDate = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const holiday = holidayMap.get(dateStr);
        return holiday !== undefined && !holiday.isWorkday;
    };

    // Loading & Error States
    const loading = isLoadingStaff || isLoadingClasses || isLoadingPatterns || isLoadingRoles || isLoadingHolidays;
    const loadError = isError ? 'データの読み込みに失敗しました。' : null;

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
        isHolidayDate,

        // 変更ハンドラ群（useScheduleActions から）
        ...actions,
    };
};
