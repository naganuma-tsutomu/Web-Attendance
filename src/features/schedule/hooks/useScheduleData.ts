import { useState, useEffect, useMemo, useRef } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { handleApiError } from '../../../lib/errorHandler';
import {
    syncHolidaysIfNeeded, getShiftRequirements,
    getShiftsByMonth, getRotationSettings
} from '../../../lib/api';
import {
    useStaffList, useClasses, useTimePatterns, useRoles, useHolidays,
    useSaveShiftsBatch, useReplaceShiftsForMonth, useUpdateShift, useDeleteShiftsByMonth, useSaveFixedDates,
    useBusinessHours, useExcelSettings, useBreakSettings, useCreateShiftSnapshot
} from '../../../lib/hooks';
import { generateShiftsForMonth } from '../../../lib/algorithm';
import { saveActiveMonth, loadActiveMonth } from '../../../utils/dateUtils';
import { UNASSIGNED_STAFF_ID } from '../../../constants';
import { useScheduleQueries } from './useScheduleQueries';
import { useCalendarEvents } from './useCalendarEvents';
import type { ShiftPreference, Shift } from '../../../types';
import type { GenerateReportData } from '../components/GenerateReportModal';

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
    const [generateReport, setGenerateReport] = useState<GenerateReportData | null>(null);

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
    const { data: breakSettings } = useBreakSettings();

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

    // Mutations
    const saveShiftsMutation = useSaveShiftsBatch();
    const replaceShiftsMutation = useReplaceShiftsForMonth();
    const updateShiftMutation = useUpdateShift();
    const deleteShiftsMutation = useDeleteShiftsByMonth();
    const saveFixedDatesMutation = useSaveFixedDates();
    const createShiftSnapshotMutation = useCreateShiftSnapshot();

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
            const [requirements, rotationSettings] = await Promise.all([
                getShiftRequirements(),
                getRotationSettings()
            ]);

            await createShiftSnapshotMutation.mutateAsync({
                yearMonth: targetYearMonth,
                reason: 'before-generate',
                label: `${format(currentDate, 'yyyy年M月')} 自動生成前`,
            });

            const prevMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
            const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
            const existingContextShifts = await Promise.all([
                getShiftsByMonth(prevMonth),
                getShiftsByMonth(nextMonth)
            ]).then(results => results.flat());

            const fixedContextShifts = rawShifts.filter(s => s.date.startsWith(targetYearMonth) && fixedDates.has(s.date));
            const mergedContext = [...existingContextShifts, ...fixedContextShifts];

            const datesForTargetMonth = Array.from(fixedDates).filter(d => d.startsWith(targetYearMonth));
            await saveFixedDatesMutation.mutateAsync({ yearMonth: targetYearMonth, dates: datesForTargetMonth });

            const generatedShifts = generateShiftsForMonth(
                targetYearMonth,
                staffList,
                preferences as ShiftPreference[],
                roles,
                classes,
                holidays.filter(h => !h.isWorkday).map(h => h.date),
                requirements,
                mergedContext,
                Array.from(fixedDates),
                businessHours?.closedDays,
                rotationSettings,
                timePatterns,
                breakSettings,
                excelSettings?.leaderRoleId ?? null
            );
            const errCount = generatedShifts.filter(s => s.staffId === UNASSIGNED_STAFF_ID).length;

            await replaceShiftsMutation.mutateAsync({
                yearMonth: targetYearMonth,
                shifts: generatedShifts,
                fixedDates: datesForTargetMonth,
            });
            setConfirmAction(null);
            setGenerateReport({
                generatedShifts: generatedShifts as Shift[],
                unassignedCount: errCount,
                yearMonth: targetYearMonth,
            });

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
                    await createShiftSnapshotMutation.mutateAsync({
                        yearMonth: targetYearMonth,
                        reason: 'before-clear',
                        label: `${format(currentDate, 'yyyy年M月')} 消去前`,
                    });
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
                    isError: editFormData.staffId === ''
                }]);
            }
            toast.success('保存しました');
        } catch (err: unknown) {
            handleApiError(err, 'シフトの保存に失敗しました');
            throw err;
        }
    };

    const toggleFixedDate = (dateStr: string) => {
        const next = new Set(fixedDates);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        const yearMonthOfDate = dateStr.slice(0, 7);
        const datesForMonth = Array.from(next).filter(d => d.startsWith(yearMonthOfDate));
        saveFixedDatesMutation.mutate({ yearMonth: yearMonthOfDate, dates: datesForMonth }, {
            onError: (err: Error) => handleApiError(err, '固定日の保存に失敗しました')
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
        breakSettings,
        summaryEvents,

        // UI状態
        loading,
        isFetching,
        generating,
        generateReport,
        setGenerateReport,
        errorCount,
        errorDates,
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
