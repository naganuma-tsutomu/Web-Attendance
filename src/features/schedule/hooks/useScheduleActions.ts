import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { handleApiError } from '../../../lib/errorHandler';
import { getShiftRequirements, getShiftsByMonth, getRotationSettings } from '../../../lib/api';
import {
    useSaveShiftsBatch, useReplaceShiftsForMonth, useUpdateShift,
    useDeleteShiftsByMonth, useSaveFixedDates, useCreateShiftSnapshot,
} from '../../../lib/hooks';
import { generateShiftsForMonth } from '../../../lib/algorithm';
import { UNASSIGNED_STAFF_ID } from '../../../constants';
import { buildGenerationReport } from '../utils/generationReport';
import type { GenerationReport, Shift, ShiftPreference, Staff, DynamicRole, ShiftClass, ShiftTimePattern, BusinessHours, ExcelSettings, BreakSettings } from '../../../types';
import type { EditFormData } from './useScheduleData';

interface UseScheduleActionsParams {
    currentDate: Date;
    targetYearMonth: string;
    rawShifts: Shift[];
    fixedDates: Set<string>;
    preferences: ShiftPreference[];
    staffList: Staff[];
    roles: DynamicRole[];
    classes: ShiftClass[];
    holidays: { date: string; isWorkday: boolean }[];
    businessHours: BusinessHours | undefined;
    excelSettings: ExcelSettings | undefined;
    breakSettings: BreakSettings | undefined;
    autoOpenGenerationReport: boolean;
    timePatterns: ShiftTimePattern[];
}

export function useScheduleActions({
    currentDate, targetYearMonth, rawShifts, fixedDates, preferences,
    staffList, roles, classes, holidays, businessHours, excelSettings,
    breakSettings, autoOpenGenerationReport, timePatterns,
}: UseScheduleActionsParams) {
    const [generating, setGenerating] = useState(false);
    const [isActionExecuting, setIsActionExecuting] = useState(false);
    const [generationReport, setGenerationReport] = useState<GenerationReport | null>(null);
    const [isGenerationReportOpen, setIsGenerationReportOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
    } | null>(null);

    const saveShiftsMutation = useSaveShiftsBatch();
    const replaceShiftsMutation = useReplaceShiftsForMonth();
    const updateShiftMutation = useUpdateShift();
    const deleteShiftsMutation = useDeleteShiftsByMonth();
    const saveFixedDatesMutation = useSaveFixedDates();
    const createShiftSnapshotMutation = useCreateShiftSnapshot();

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
                preferences,
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

            setGenerationReport(buildGenerationReport({
                yearMonth: targetYearMonth,
                shifts: generatedShifts,
                staffList,
                classes,
                fixedDateCount: datesForTargetMonth.length,
                breakSettings,
            }));
            setIsGenerationReportOpen(autoOpenGenerationReport);
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
        generating,
        isActionExecuting,
        generationReport,
        isGenerationReportOpen,
        confirmAction,
        setConfirmAction,
        setIsGenerationReportOpen,
        handleGenerate,
        handleClearShifts,
        handleUpdateShift,
        toggleFixedDate,
    };
}
