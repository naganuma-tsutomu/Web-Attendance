import { useState, useEffect, useMemo, useRef } from 'react';
import { Views, type View } from 'react-big-calendar';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { toast } from 'sonner';
import { handleApiError } from '../../../lib/errorHandler';
import { useQueries } from '@tanstack/react-query';
import { 
    syncHolidaysIfNeeded, getShiftRequirements,
    getShiftsByMonth, getPreferencesByMonth, getFixedDates
} from '../../../lib/api';
import { 
    useStaffList, useClasses, useTimePatterns, useRoles, useHolidays, 
    useSaveShiftsBatch, useUpdateShift, useDeleteShiftsByMonth, useSaveFixedDates,
    useBusinessHours,
    QUERY_KEYS
} from '../../../lib/hooks';
import { generateShiftsForMonth, isStaffAvailableReason } from '../../../lib/algorithm';
import { saveActiveMonth, loadActiveMonth, getWeekStartsOn } from '../../../utils/dateUtils';
import type { Shift, ShiftPreference } from '../../../types';


// カレンダーイベントの型定義
export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId: string;
    isError: boolean;
    isEarly: boolean;
    isSummary?: boolean;
    type?: string;
    classNameValue?: string;
    classColor?: string;
}

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

    // Queries: 単一データフェッチ
    const { data: staffList = [], isLoading: isLoadingStaff } = useStaffList();
    const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
    const { data: timePatterns = [], isLoading: isLoadingPatterns } = useTimePatterns();
    const { data: roles = [], isLoading: isLoadingRoles } = useRoles();
    const { data: holidays = [], isLoading: isLoadingHolidays } = useHolidays(currentDate.getFullYear());
    const { data: businessHours } = useBusinessHours();

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

    // 表示ビューに応じた必要な取得月を計算
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

    // Queries: 動的な複数月のデータフェッチ
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

    // データの集約
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

    // Loading & Error States
    const isFetchingDynamic = shiftQueries.some(q => q.isLoading) || prefQueries.some(q => q.isLoading) || fixedDatesQueries.some(q => q.isLoading);
    const loading = isLoadingStaff || isLoadingClasses || isLoadingPatterns || isLoadingRoles || isLoadingHolidays || isFetchingDynamic;
    const isError = shiftQueries.some(q => q.isError) || prefQueries.some(q => q.isError);
    const loadError = isError ? 'データの読み込みに失敗しました。' : null;

    // Mutations
    const saveShiftsMutation = useSaveShiftsBatch();
    const updateShiftMutation = useUpdateShift();
    const deleteShiftsMutation = useDeleteShiftsByMonth();
    const saveFixedDatesMutation = useSaveFixedDates();

    // カレンダーイベントの計算
    const { events, errorCount } = useMemo(() => {
        let errCount = 0;
        const calendarEvents: CalendarEvent[] = rawShifts.map(shift => {
            if (shift.isError) errCount++;
            const staff = staffList.find(s => s.id === shift.staffId);
            const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');

            const shiftClass = classes.find(c => c.id === shift.classType);
            const className = shiftClass ? shiftClass.name : shift.classType;

            let titleSuffix = '';
            if (shift.isError) titleSuffix = '(エラー)';
            else titleSuffix = shift.isEarlyShift ? '(早番)' : '(遅番)';

            return {
                id: shift.id,
                title: `${staffName}${titleSuffix}`,
                start: new Date(`${shift.date}T${shift.startTime}:00`),
                end: new Date(`${shift.date}T${shift.endTime}:00`),
                resourceId: shift.classType,
                isError: shift.isError ?? false,
                isEarly: shift.isEarlyShift,
                classNameValue: className,
                classColor: shiftClass?.color
            };
        });
        return { events: calendarEvents, errorCount: errCount };
    }, [rawShifts, staffList, classes]);

    // 初期化と同期
    useEffect(() => {
        syncHolidaysIfNeeded().catch(err => console.error('Failed to sync holidays', err));
    }, []);

    useEffect(() => {
        saveActiveMonth(currentDate);
    }, [currentDate]);

    // リフレッシュ関数（エラー時のリトライ用）
    const loadShifts = () => {
        shiftQueries.forEach(q => q.refetch());
        prefQueries.forEach(q => q.refetch());
    };

    // 月間サマリーイベント
    const summaryEvents = useMemo(() => {
        if (view !== Views.MONTH) return events;

        const dailySummary: Record<string, { classes: Record<string, number>; insufficient: number; requestedOff: number; training: number; fixedOff: number }> = {};

        events.forEach(event => {
            const dateStr = format(event.start, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, training: 0, fixedOff: 0 };
            }

            if (event.isError) {
                dailySummary[dateStr].insufficient++;
            } else {
                const className = event.classNameValue || 'その他';
                dailySummary[dateStr].classes[className] = (dailySummary[dateStr].classes[className] || 0) + 1;
            }
        });

        const [year, month] = targetYearMonth.split('-').map(Number);
        const dStart = startOfMonth(new Date(year, month - 1));
        const dEnd = endOfMonth(dStart);
        const daysInMonth = eachDayOfInterval({ start: dStart, end: dEnd });
        const closedDays = businessHours?.closedDays || [0];

        daysInMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, training: 0, fixedOff: 0 };
            }

            staffList.forEach(staff => {
                const dayOfWeek = getDay(day);
                if (closedDays.includes(dayOfWeek)) return;

                const pref = preferences.find(p => p.staffId === staff.id);
                let isTraining = false;
                let isReqOff = false;

                if (pref) {
                    const detailMatch = pref.details && pref.details.find((d: any) => d.date === dateStr);
                    if (detailMatch && detailMatch.type === 'training') {
                        isTraining = true;
                    } else if (detailMatch) {
                        isReqOff = true;
                    }
                }

                if (isTraining) {
                    dailySummary[dateStr].training++;
                } else if (isReqOff) {
                    dailySummary[dateStr].requestedOff++;
                } else {
                    const reason = isStaffAvailableReason(staff, day, dateStr, preferences);
                    if (reason === 'fixed') {
                        dailySummary[dateStr].fixedOff++;
                    }
                }
            });
        });

        const summaries: CalendarEvent[] = [];
        Object.entries(dailySummary).forEach(([dateStr, data]) => {
            const baseDate = new Date(`${dateStr}T00:00:00`);

            classes.forEach(cls => {
                const count = data.classes[cls.name];
                if (count > 0) {
                    summaries.push({
                        id: `summary-class-${cls.id}-${dateStr}`,
                        title: `${cls.name}: ${count}名`,
                        start: baseDate,
                        end: baseDate,
                        resourceId: '',
                        isError: false,
                        isEarly: false,
                        isSummary: true,
                        type: 'class',
                        classNameValue: cls.name,
                        classColor: cls.color
                    });
                }
            });

            if (data.insufficient > 0) {
                summaries.push({
                    id: `summary-insufficient-${dateStr}`,
                    title: `不足: ${data.insufficient}名`,
                    start: baseDate,
                    end: baseDate,
                    resourceId: '',
                    isError: true,
                    isEarly: false,
                    isSummary: true,
                    type: 'error'
                });
            }

            if (data.training > 0) {
                summaries.push({
                    id: `summary-training-${dateStr}`,
                    title: `研修: ${data.training}名`,
                    start: baseDate,
                    end: baseDate,
                    resourceId: '',
                    isError: false,
                    isEarly: false,
                    isSummary: true,
                    type: 'training'
                });
            }

            if (data.requestedOff > 0) {
                summaries.push({
                    id: `summary-req-off-${dateStr}`,
                    title: `希望休: ${data.requestedOff}名`,
                    start: baseDate,
                    end: baseDate,
                    resourceId: '',
                    isError: false,
                    isEarly: false,
                    isSummary: true,
                    type: 'requested-off'
                });
            }

            if (data.fixedOff > 0) {
                summaries.push({
                    id: `summary-fixed-off-${dateStr}`,
                    title: `固定休: ${data.fixedOff}名`,
                    start: baseDate,
                    end: baseDate,
                    resourceId: '',
                    isError: false,
                    isEarly: false,
                    isSummary: true,
                    type: 'fixed-off'
                });
            }
        });
        return summaries;
    }, [view, targetYearMonth, events, staffList, preferences, classes, businessHours?.closedDays]);

    // イベントスタイル
    const eventStyleGetter = (event: CalendarEvent) => {
        const style: Record<string, string | number> = {
            borderRadius: '4px',
            opacity: (view === Views.MONTH && !isSameMonth(event.start, currentDate)) ? 0.4 : 0.9,
            color: 'white',
            border: '0px',
            display: 'block',
            fontSize: '11px',
            padding: '2px 4px',
            cursor: 'pointer'
        };

        if (event.isError || event.type === 'error') {
            style.backgroundColor = '#94a3b8';
        } else if (event.type === 'requested-off') {
            style.backgroundColor = '#ef4444';
        } else if (event.type === 'training') {
            style.backgroundColor = '#f59e0b';
        } else if (event.type === 'fixed-off') {
            style.backgroundColor = '#cbd5e1';
            style.color = '#475569';
        } else if (event.type === 'class') {
            // DB の color フィールドのみを使用（ハードコード色なし）
            style.backgroundColor = event.classColor || '#6366f1';
        } else if (event.isEarly) {
            style.backgroundColor = '#3b82f6';
        } else {
            style.backgroundColor = '#f59e0b';
        }

        return { style };
    };

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
                preferences,
                roles,
                classes,
                holidays.map(h => h.date),
                requirements,
                mergedContext,
                Array.from(fixedDates),
                businessHours?.closedDays
            );
            const errCount = generatedShifts.filter(s => s.staffId === 'UNASSIGNED').length;

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

    // シフト更新ハンドラ
    const handleUpdateShift = async (
        editFormData: EditFormData,
        selectedEvent: CalendarEvent | null
    ) => {
        try {
            if (selectedEvent) {
                await updateShiftMutation.mutateAsync({
                    id: selectedEvent.id,
                    data: {
                        staffId: editFormData.staffId || 'UNASSIGNED',
                        startTime: editFormData.startTime,
                        endTime: editFormData.endTime,
                        isError: editFormData.staffId === ''
                    }
                });
            } else {
                const dateStr = editFormData.date || format(currentDate, 'yyyy-MM-01');
                await saveShiftsMutation.mutateAsync([{
                    date: dateStr,
                    staffId: editFormData.staffId || 'UNASSIGNED',
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

    // 固定日のトグル
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
        summaryEvents,
        businessHours,

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
