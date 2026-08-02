import { useRef, useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { handleApiError } from '../../../lib/errorHandler';
import {
    getShiftRequirements, getShiftsByMonth, getRotationSettings, getStaffList,
    getPreferencesByMonth, getRoles, getClasses, getHolidays, getBusinessHours,
    getExcelSettings, getBreakSettings, getTimePatterns, getFixedDates, getBusinessDayOverrides,
} from '../../../lib/api';
import {
    useSaveShiftsBatch, useReplaceShiftsForMonth, useUpdateShift,
    useDeleteShiftsByMonth, useCreateShiftSnapshot, useToggleFixedDate,
    useSaveFixedDates,
} from '../../../lib/hooks';
import { generateShiftsForMonth } from '../../../lib/algorithm';
import { findShiftConflict } from '../../../../shared/shiftIntegrity';
import { UNASSIGNED_STAFF_ID } from '../../../constants';
import { buildGenerationReport } from '../utils/generationReport';
import type { GenerationReport, Shift, ShiftClass } from '../../../types';
import type { EditFormData } from './useScheduleData';

interface UseScheduleActionsParams {
    currentDate: Date;
    targetYearMonth: string;
    fixedDates: Set<string>;
    rawShifts: Shift[];
    classes: ShiftClass[];
    autoOpenGenerationReport: boolean;
}

export function useScheduleActions({
    currentDate, targetYearMonth, fixedDates, rawShifts, classes, autoOpenGenerationReport,
}: UseScheduleActionsParams) {
    const fixedDatesRef = useRef(fixedDates);
    fixedDatesRef.current = fixedDates;
    const [generating, setGenerating] = useState(false);
    const [isActionExecuting, setIsActionExecuting] = useState(false);
    const [generationReport, setGenerationReport] = useState<GenerationReport | null>(null);
    const [isGenerationReportOpen, setIsGenerationReportOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: (checked?: boolean) => void;
        variant?: 'danger' | 'info';
        checkboxLabel?: string;
    } | null>(null);

    const saveShiftsMutation = useSaveShiftsBatch();
    const replaceShiftsMutation = useReplaceShiftsForMonth();
    const updateShiftMutation = useUpdateShift();
    const deleteShiftsMutation = useDeleteShiftsByMonth();
    const toggleFixedDateMutation = useToggleFixedDate();
    const saveFixedDatesMutation = useSaveFixedDates();
    const createShiftSnapshotMutation = useCreateShiftSnapshot();

    const executeGenerate = async () => {
        setIsActionExecuting(true);
        setGenerating(true);
        try {
            const prevMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
            const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
            const [
                latestStaffList,
                latestPreferences,
                latestRoles,
                latestClasses,
                latestHolidays,
                latestBusinessHours,
                latestExcelSettings,
                latestBreakSettings,
                latestTimePatterns,
                requirements,
                rotationSettings,
                targetMonthShifts,
                previousMonthShifts,
                nextMonthShifts,
                latestFixedDates,
                latestBusinessDayOverrides,
            ] = await Promise.all([
                getStaffList(),
                getPreferencesByMonth(targetYearMonth),
                getRoles(),
                getClasses(),
                getHolidays(currentDate.getFullYear()),
                getBusinessHours(),
                getExcelSettings(),
                getBreakSettings(),
                getTimePatterns(),
                getShiftRequirements(),
                getRotationSettings(),
                getShiftsByMonth(targetYearMonth),
                getShiftsByMonth(prevMonth),
                getShiftsByMonth(nextMonth),
                getFixedDates(targetYearMonth),
                getBusinessDayOverrides(targetYearMonth),
            ]);

            const fixedDateSet = new Set(latestFixedDates);
            const fixedContextShifts = targetMonthShifts.filter(s => fixedDateSet.has(s.date));
            const mergedContext = [...previousMonthShifts, ...nextMonthShifts, ...fixedContextShifts];

            const generatedShifts = generateShiftsForMonth(
                targetYearMonth,
                latestStaffList,
                latestPreferences,
                latestRoles,
                latestClasses,
                latestBusinessHours.closedDays.includes(7)
                    ? latestHolidays.filter(h => !h.isWorkday).map(h => h.date)
                    : [],
                requirements,
                mergedContext,
                latestFixedDates,
                latestBusinessHours.closedDays,
                rotationSettings,
                latestTimePatterns,
                latestBreakSettings,
                latestExcelSettings.leaderRoleId ?? null,
                latestBusinessDayOverrides
            );
            const generatedConflict = findShiftConflict(generatedShifts);
            if (generatedConflict) {
                const staffName = latestStaffList.find(s => s.id === generatedConflict.first.staffId)?.name
                    ?? generatedConflict.first.staffId;
                throw new Error(
                    `${generatedConflict.first.date}の${staffName}に重複するシフトが生成されました。保存は行われていません。`
                );
            }
            const errCount = generatedShifts.filter(s => s.staffId === UNASSIGNED_STAFF_ID).length;

            await createShiftSnapshotMutation.mutateAsync({
                yearMonth: targetYearMonth,
                reason: 'before-generate',
                label: `${format(currentDate, 'yyyy年M月')} 自動生成前`,
            });

            await replaceShiftsMutation.mutateAsync({
                yearMonth: targetYearMonth,
                shifts: generatedShifts,
                fixedDates: latestFixedDates,
            });

            setGenerationReport(buildGenerationReport({
                yearMonth: targetYearMonth,
                shifts: generatedShifts,
                staffList: latestStaffList,
                classes: latestClasses,
                fixedDateCount: latestFixedDates.length,
                breakSettings: latestBreakSettings,
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
        if (toggleFixedDateMutation.isPending) {
            toast.warning('固定日の保存完了後に自動生成を実行してください。');
            return;
        }
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
            message: 'この月のロックされていないシフトを削除します。',
            checkboxLabel: 'ロック済みのシフトも削除する（ロックも解除されます）',
            onConfirm: async (includeFixedDates = false) => {
                setIsActionExecuting(true);
                try {
                    await createShiftSnapshotMutation.mutateAsync({
                        yearMonth: targetYearMonth,
                        reason: 'before-clear',
                        label: `${format(currentDate, 'yyyy年M月')} 消去前`,
                    });
                    await deleteShiftsMutation.mutateAsync({
                        yearMonth: targetYearMonth,
                        exceptDates: includeFixedDates ? [] : Array.from(fixedDatesRef.current),
                        clearFixedDates: includeFixedDates,
                    });
                    if (includeFixedDates) {
                        fixedDatesRef.current = new Set();
                    }
                    toast.success(includeFixedDates
                        ? 'ロック済みを含むシフトを削除し、ロックを解除しました'
                        : 'ロックされていないシフトを削除しました'
                    );
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

    const handleLockAllShifts = async () => {
        if (toggleFixedDateMutation.isPending) {
            toast.warning('個別ロックの保存完了後に実行してください');
            return;
        }
        const shiftDates = new Set(
            rawShifts
                .filter(shift => shift.date.startsWith(targetYearMonth))
                .map(shift => shift.date)
        );
        if (shiftDates.size === 0) {
            toast.info('ロックできるシフトがありません');
            return;
        }

        const next = new Set(fixedDatesRef.current);
        shiftDates.forEach(date => next.add(date));
        try {
            await saveFixedDatesMutation.mutateAsync({
                yearMonth: targetYearMonth,
                dates: Array.from(next).sort(),
            });
            fixedDatesRef.current = next;
            toast.success(`${shiftDates.size}日分のシフトをロックしました`);
        } catch (err) {
            handleApiError(err, '一括ロックに失敗しました');
        }
    };

    const handleUnlockAllShifts = async () => {
        if (toggleFixedDateMutation.isPending) {
            toast.warning('個別ロックの保存完了後に実行してください');
            return;
        }
        if (fixedDatesRef.current.size === 0) {
            toast.info('解除するロックがありません');
            return;
        }
        try {
            await saveFixedDatesMutation.mutateAsync({
                yearMonth: targetYearMonth,
                dates: [],
            });
            fixedDatesRef.current = new Set();
            toast.success('この月のロックをすべて解除しました');
        } catch (err) {
            handleApiError(err, '一括ロック解除に失敗しました');
        }
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
        if (saveFixedDatesMutation.isPending) {
            toast.warning('一括ロック操作の完了後に変更してください');
            return;
        }
        const next = new Set(fixedDatesRef.current);
        const fixed = !next.has(dateStr);
        if (fixed) next.add(dateStr);
        else next.delete(dateStr);
        fixedDatesRef.current = next;
        toggleFixedDateMutation.mutate({ date: dateStr, fixed }, {
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
        handleLockAllShifts,
        handleUnlockAllShifts,
        isBulkLockPending: saveFixedDatesMutation.isPending || toggleFixedDateMutation.isPending,
    };
}
