import { useState, useEffect, useMemo, useRef } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { handleApiError } from '../../../lib/errorHandler';
import {
    syncHolidaysIfNeeded, getShiftRequirements,
    getShiftsByMonth, getFixedDates as _getFixedDates
} from '../../../lib/api';
import {
    useStaffList, useClasses, useTimePatterns, useRoles, useHolidays,
    useSaveShiftsBatch, useUpdateShift, useDeleteShiftsByMonth, useSaveFixedDates,
    useBusinessHours, useExcelSettings,
} from '../../../lib/hooks';
import { generateShiftsForMonth } from '../../../lib/algorithm';
import { saveActiveMonth, loadActiveMonth } from '../../../utils/dateUtils';
import { UNASSIGNED_STAFF_ID } from '../../../constants';
import { useScheduleQueries } from './useScheduleQueries';
import { useCalendarEvents } from './useCalendarEvents';
import type { ShiftPreference } from '../../../types';

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
    const [generating, setGenerating] = useState(false);
    const [isDayModified, setIsDayModified] = useState(false);
    const daySaveRef = useRef<(() => Promise<void>) | null>(null);
    const [isActionExecuting, setIsActionExecuting] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
    } | null>(null);

    // 静的データ
    const { data: staffList = [], isLoading: isLoadingStaff } = useStaffList();
    const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
    const { data: timePatterns = [], isLoading: isLoadingPatterns } = useTimePatterns();
    const { data: roles = [], isLoading: isLoadingRoles } = useRoles();
    const { data: holidays = [], isLoading: isLoadingHolidays } = useHolidays(currentDate.getFullYear());
    const { data: businessHours } = useBusinessHours();
    const { data: excelSettings } = useExcelSettings();

    // 動的な複数月データフェッチ
    const { rawShifts, preferences, fixedDates, isFetching, isError, refetch } = useScheduleQueries(currentDate, view);

    // カレンダーイベント構築
    const { events, summaryEvents, errorCount, eventStyleGetter } = useCalendarEvents(
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
    const loading = isLoadingStaff || isLoadingClasses || isLoadingPatterns || isLoadingRoles || isLoadingHolidays || isFetching;
    const loadError = isError ? 'データの読み込みに失敗しました。' : null;

    // Mutations
    const saveShiftsMutation = useSaveShiftsBatch();
    const updateShiftMutation = useUpdateShift();
    const deleteShiftsMutation = useDeleteShiftsByMonth();
    const saveFixedDatesMutation = useSaveFixedDates();

    // 初期化と同期
    useEffect(() => {
        syncHolidaysIfNeeded().catch(err => console.error('Failed to sync holidays', err));
    }, []);

    useEffect(() => {
        saveActiveMonth(currentDate);
    }, [currentDate]);

    const loadShifts = () => refetch();

    // シフト自動生成
    const executeGenerate = async () => {
        setIsActionExecuting(true);
        setGenerating(true);
        try {
            const requirements = await getShiftRequirements();

            const prevMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
            const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
            const existingContextShifts = await Promise.all([
                getShiftsByMonth(prevMonth),
                getShiftsByMonth(nextMonth)
            ]).then(results => results.flat());

            const fixedContextShifts = rawShifts.filter(s => s.date.startsWith(targetYearMonth) && fixedDates.has(s.date));
            const mergedContext = [...existingContextShifts, ...fixedContextShifts];

            await saveFixedDatesMutation.mutateAsync({ yearMonth: targetYearMonth, dates: Array.from(fixedDates) });
            await deleteShiftsMutation.mutateAsync({ yearMonth: targetYearMonth, exceptDates: Array.from(fixedDates) });

            const generatedShifts = generateShiftsForMonth(
                targetYearMonth,
                staffList,
                preferences as ShiftPreference[],
                roles,
                classes,
                holidays.map(h => h.date),
                requirements,
                mergedContext,
                Array.from(fixedDates),
                businessHours?.closedDays
            );
            const errCount = generatedShifts.filter(s => s.staffId === UNASSIGNED_STAFF_ID).length;

            await saveShiftsMutation.mutateAsync(generatedShifts);
            setConfirmAction(null);

            if (errCount > 0) {
                toast.warning(`自動生成完了: ${errCount}件の割り当て不足があります。`);
            } else {
                toast.success('シフトの自動生成が完了しました！');
            }
        } catch (err) {
            handleApiError(err, 'シフト生成中にエラーが発生しました');
        } finally {
            setGenerating(false);
            setIsActionExecuting(false);
        }
    };

    const handleGenerate = () => {
        setConfirmAction({
            title: 'シフトの自動生成',
            message: `${format(currentDate, 'yyyy年M月')} のシフトを自動生成します。既存のシフトは上書きされます。よろしいですか？`,
            onConfirm: executeGenerate,
            variant: 'info'
        });
    };

    const handleClearShifts = () => {
        setConfirmAction({
            title: 'シフトの消去',
            message: 'この月のシフトをすべて削除してよろしいですか？',
            onConfirm: async () => {
                setIsActionExecuting(true);
                try {
                    await deleteShiftsMutation.mutateAsync({ yearMonth: targetYearMonth });
                    toast.success('削除しました');
                    setConfirmAction(null);
                } catch (err) {
                    handleApiError(err, '削除に失敗しました');
                } finally {
                    setIsActionExecuting(false);
                }
            },
            variant: 'danger'
        });
    };

    const handleUpdateShift = async (
        editFormData: EditFormData,
        selectedEvent: import('./useCalendarEvents').CalendarEvent | null
    ) => {
        try {
            if (selectedEvent) {
                await updateShiftMutation.mutateAsync({
                    id: selectedEvent.id,
                    data: {
                        staffId: editFormData.staffId || UNASSIGNED_STAFF_ID,
                        startTime: editFormData.startTime,
                        endTime: editFormData.endTime,
                        isError: editFormData.staffId === ''
                    }
                });
            } else {
                const dateStr = editFormData.date || format(currentDate, 'yyyy-MM-01');
                await saveShiftsMutation.mutateAsync([{
                    date: dateStr,
                    staffId: editFormData.staffId || UNASSIGNED_STAFF_ID,
                    startTime: editFormData.startTime,
                    endTime: editFormData.endTime,
                    classType: classes[0]?.id || 'class_niji',
                    isEarlyShift: false,
                    isError: editFormData.staffId === ''
                }]);
            }
            toast.success('保存しました');
        } catch (err) {
            handleApiError(err, '保存に失敗しました');
            throw err;
        }
    };

    const toggleFixedDate = (dateStr: string) => {
        const next = new Set(fixedDates);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        saveFixedDatesMutation.mutate({ yearMonth: targetYearMonth, dates: Array.from(next) }, {
            onError: (err) => handleApiError(err, '固定日の保存に失敗しました')
        });
    };

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
        summaryEvents,

        // UI状態
        loading,
        generating,
        errorCount,
        loadError,
        currentDate,
        view,
        isDayModified,
        daySaveRef,
        confirmAction,
        isActionExecuting,

        // 派生値
        targetYearMonth,
        holidayMap,

        // アクション
        setCurrentDate,
        setView,
        setIsDayModified,
        setConfirmAction,
        loadShifts,
        handleGenerate,
        handleClearShifts,
        handleUpdateShift,
        toggleFixedDate,
        eventStyleGetter,
        getHolidayNameForDate,
        isHolidayDate,
    };
};
