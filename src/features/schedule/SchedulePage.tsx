import { useState, useCallback, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { useCalendarInteractions } from './hooks/useCalendarInteractions';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, type Locale } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import DailyTimelineModal from './DailyTimelineModal';
import DailyTimelineView from './DailyTimelineView';
import WeeklyTimelineView from './WeeklyTimelineView';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StaffWorkHoursSummary from './components/StaffWorkHoursSummary';
import ScheduleHeader from './components/ScheduleHeader';
import ShiftEditModal from './components/ShiftEditModal';
import MobileWorkHoursPanel from './components/MobileWorkHoursPanel';
import ShiftBackupModal from './components/ShiftBackupModal';
import ShiftImportModal from './components/ShiftImportModal';
import GenerationReportModal from './components/GenerationReportModal';
import CalendarDateHeader from './components/CalendarDateHeader';
import CalendarDateCellWrapper from './components/CalendarDateCellWrapper';
import { CalendarDisplayContext } from './context/CalendarDisplayContext';
import { useScheduleData, type CalendarEvent, type EditFormData } from './hooks/useScheduleData';
import { getWeekStartsOn } from '../../utils/dateUtils';
import { UNASSIGNED_STAFF_ID } from '../../constants';
import { useUnsavedChanges } from '../../lib/UnsavedChangesContext';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date, options?: { locale?: Locale }) => startOfWeek(date, { ...options, weekStartsOn: getWeekStartsOn() }),
    getDay,
    locales: { 'ja': ja },
});

const SchedulePage = () => {
    const schedule = useScheduleData();
    const { setGuard, requestTransition } = useUnsavedChanges();

    useEffect(() => {
        setGuard({
            dirty: schedule.isDayModified,
            save: async () => {
                if (!schedule.daySaveRef.current) throw new Error('保存処理を開始できません');
                await schedule.daySaveRef.current();
            },
            discard: () => schedule.dayDiscardRef.current?.(),
        });
        return () => setGuard(null);
    }, [schedule.isDayModified, schedule.daySaveRef, schedule.dayDiscardRef, setGuard]);

    const handleDateChange = useCallback((date: Date) => {
        requestTransition(() => schedule.setCurrentDate(date));
    }, [requestTransition, schedule]);

    const handleViewChange = useCallback((view: View) => {
        requestTransition(() => schedule.setView(view));
    }, [requestTransition, schedule]);

    // ローカルUI状態（モーダル等）
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [editFormData, setEditFormData] = useState<EditFormData>({
        staffId: '',
        date: '',
        startTime: '',
        endTime: ''
    });
    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
    const [selectedDateForTimeline, setSelectedDateForTimeline] = useState<Date | null>(null);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleOpenTimeline = useCallback((date: Date) => {
        setSelectedDateForTimeline(date);
        setIsTimelineModalOpen(true);
    }, []);

    const { calendarKey, calendarContainerRef, lastTouchOpenRef, isTouchDevice } = useCalendarInteractions(
        schedule.currentDate,
        schedule.view,
        handleOpenTimeline
    );

    const { fixedDates, getHolidayNameForDate, isHolidayDate, toggleFixedDate } = schedule;
    const calendarDisplayValue = useMemo(() => ({
        fixedDates,
        toggleFixedDate,
        getHolidayNameForDate,
        isHolidayDate,
        handleOpenTimeline,
        lastTouchOpenRef,
    }), [fixedDates, toggleFixedDate, getHolidayNameForDate, isHolidayDate, handleOpenTimeline, lastTouchOpenRef]);

    const calendarComponents = useMemo(() => ({
        toolbar: () => null,
        month: { dateHeader: CalendarDateHeader },
        dateCellWrapper: CalendarDateCellWrapper,
    }), []);

    const handleEventSelect = (event: CalendarEvent) => {
        setSelectedEvent(event);
        const shift = schedule.rawShifts.find(s => s.id === event.id);
        if (shift) {
            setEditFormData({
                staffId: shift.staffId === UNASSIGNED_STAFF_ID ? '' : shift.staffId,
                date: shift.date,
                startTime: shift.startTime,
                endTime: shift.endTime
            });
            setIsEditModalOpen(true);
        }
    };

    const handleUpdateShift = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await schedule.handleUpdateShift(editFormData, selectedEvent);
            setIsEditModalOpen(false);
        } catch {
            // エラーはhook内でtoast済み
        }
    };

    return (
        <div className="h-full flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 max-w-7xl mx-auto w-full">
            {/* Header Area */}
            <ScheduleHeader
                currentDate={schedule.currentDate}
                view={schedule.view}
                generating={schedule.generating}
                errorCount={schedule.errorCount}
                errorDates={schedule.errorDates}
                loadError={schedule.loadError}
                isFetching={schedule.isFetching}
                isSummaryOpen={isSummaryOpen}
                targetYearMonth={schedule.targetYearMonth}
                staffList={schedule.staffList}
                rawShifts={schedule.rawShifts}
                classes={schedule.classes}
                timePatterns={schedule.timePatterns}
                preferences={schedule.preferences}
                holidays={schedule.holidays}
                onDateChange={handleDateChange}
                onViewChange={handleViewChange}
                onGenerate={schedule.handleGenerate}
                onClearShifts={schedule.handleClearShifts}
                onOpenBackups={() => setIsBackupModalOpen(true)}
                onOpenImport={() => setIsImportModalOpen(true)}
                onOpenGenerationReport={() => schedule.setIsGenerationReportOpen(true)}
                onToggleSummary={() => setIsSummaryOpen(!isSummaryOpen)}
                onRetry={schedule.loadShifts}
                onErrorDateClick={handleOpenTimeline}
                businessHours={schedule.businessHours}
                excelSettings={schedule.excelSettings}
                breakSettings={schedule.breakSettings}
                roles={schedule.roles}
                hasGenerationReport={!!schedule.generationReport}
            />

            {/* Calendar and Summary Area */}
            <div className="flex-1 overflow-hidden px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 flex flex-col lg:flex-row gap-4">
                <div className="flex-1 h-full min-w-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-2 sm:p-4 relative flex flex-col overflow-hidden">
                    {schedule.loading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        </div>
                    )}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {schedule.view === Views.DAY ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <DailyTimelineView
                                    date={schedule.currentDate}
                                    shifts={schedule.rawShifts}
                                    staffList={schedule.staffList}
                                    classes={schedule.classes}
                                    timePatterns={schedule.timePatterns}
                                    roles={schedule.roles}
                                    preferences={schedule.preferences}
                                    onShiftUpdate={schedule.loadShifts}
                                    onModifiedChange={schedule.setIsDayModified}
                                    saveRef={schedule.daySaveRef}
                                    discardRef={schedule.dayDiscardRef}
                                    isFixed={schedule.fixedDates.has(format(schedule.currentDate, 'yyyy-MM-dd'))}
                                    onToggleFixed={() => schedule.toggleFixedDate(format(schedule.currentDate, 'yyyy-MM-dd'))}
                                    showDutyNumbers={schedule.excelSettings?.showDutyNumbers}
                                    leaderRoleId={schedule.excelSettings?.leaderRoleId}
                                />
                                <div className={`mt-4 flex-shrink-0 flex items-center justify-end gap-3 transition-all duration-200 pb-2 ${schedule.isDayModified ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                                    <div className="hidden sm:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mr-2 text-xs">
                                        <Save className="w-4 h-4" />
                                        <span>未保存の変更があります</span>
                                    </div>
                                    <button
                                        onClick={() => schedule.dayDiscardRef.current?.()}
                                        className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                                    >
                                        破棄
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (schedule.daySaveRef.current) {
                                                try {
                                                    await schedule.daySaveRef.current();
                                                    toast.success('保存しました');
                                                } catch (e) {
                                                    console.error(e);
                                                    if (e instanceof Error && e.message) {
                                                        toast.error(e.message);
                                                    } else {
                                                        toast.error('保存に失敗しました');
                                                    }
                                                }
                                            }
                                        }}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        保存
                                    </button>
                                </div>
                            </div>
                        ) : schedule.view === Views.WEEK ? (
                            <div className="flex-1 overflow-hidden">
                                <WeeklyTimelineView
                                    startDate={schedule.currentDate}
                                    shifts={schedule.rawShifts}
                                    staffList={schedule.staffList}
                                    classes={schedule.classes}
                                    timePatterns={schedule.timePatterns}
                                    roles={schedule.roles}
                                    businessHours={schedule.businessHours}
                                    isHolidayDate={schedule.isHolidayDate}
                                    onDateClick={(date) => handleOpenTimeline(date)}
                                />
                            </div>
                        ) : (
                            <CalendarDisplayContext.Provider value={calendarDisplayValue}>
                            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 hidden-scrollbar" ref={calendarContainerRef}>
                                <div className="rb-calendar-container h-full">
                                    <BigCalendar
                                        key={calendarKey}
                                    localizer={localizer}
                                    events={schedule.summaryEvents}
                                    startAccessor="start"
                                    endAccessor="end"
                                    culture="ja"
                                    selectable={!isTouchDevice}
                                    onSelectSlot={({ start }) => handleOpenTimeline(start as Date)}
                                    eventPropGetter={schedule.eventStyleGetter}
                                    onSelectEvent={(event: CalendarEvent) => {
                                        if (event.isSummary) {
                                            handleOpenTimeline(event.start as Date);
                                            return;
                                        }
                                        handleEventSelect(event);
                                    }}
                                    views={{
                                        month: true,
                                        week: true,
                                        day: true,
                                    }}
                                    view={schedule.view}
                                    onView={(v) => handleViewChange(v as View)}
                                    date={schedule.currentDate}
                                    onNavigate={handleDateChange}
                                    onDrillDown={(date) => handleOpenTimeline(date)}
                                    components={calendarComponents}
                                    messages={{
                                        next: "次",
                                        previous: "前",
                                        today: "今日",
                                        month: "月",
                                        week: "週",
                                        day: "日",
                                        agenda: "予定",
                                        showMore: (count) => `+他${count}件`
                                    }}
                                    onShowMore={(_events, date) => handleOpenTimeline(date)}
                                />
                                </div>
                            </div>
                            </CalendarDisplayContext.Provider>
                        )}
                    </div>
                </div>

                {/* Staff Work Hours Summary Side Panel (Desktop) */}
                <div className="hidden lg:block">
                    <StaffWorkHoursSummary
                        staffs={schedule.staffList}
                        shifts={schedule.rawShifts}
                        isOpen={isSummaryOpen}
                        viewDate={schedule.currentDate}
                    />
                </div>
            </div>

            {/* Staff Work Hours Summary (Mobile Overlay) */}
            <MobileWorkHoursPanel
                isOpen={isSummaryOpen}
                staffs={schedule.staffList}
                shifts={schedule.rawShifts}
                viewDate={schedule.currentDate}
                onClose={() => setIsSummaryOpen(false)}
            />

            {/* Shift Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} aria-labelledby="shift-edit-dialog-title">
                <ShiftEditModal
                    selectedEvent={selectedEvent}
                    editFormData={editFormData}
                    currentDate={schedule.currentDate}
                    staffList={schedule.staffList}
                    onFormChange={setEditFormData}
                    onSubmit={handleUpdateShift}
                    onClose={() => setIsEditModalOpen(false)}
                />
            </Modal>

            {/* Daily Timeline Modal */}
            {isTimelineModalOpen && selectedDateForTimeline && (
                <DailyTimelineModal
                    date={selectedDateForTimeline}
                    shifts={schedule.rawShifts}
                    staffList={schedule.staffList}
                    classes={schedule.classes}
                    timePatterns={schedule.timePatterns}
                    roles={schedule.roles}
                    preferences={schedule.preferences}
                    onClose={() => setIsTimelineModalOpen(false)}
                    onShiftUpdate={schedule.loadShifts}
                    isFixed={schedule.fixedDates.has(format(selectedDateForTimeline, 'yyyy-MM-dd'))}
                    onToggleFixed={() => schedule.toggleFixedDate(format(selectedDateForTimeline, 'yyyy-MM-dd'))}
                    showDutyNumbers={schedule.excelSettings?.showDutyNumbers}
                    leaderRoleId={schedule.excelSettings?.leaderRoleId}
                />
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!schedule.confirmAction}
                title={schedule.confirmAction?.title || ''}
                message={schedule.confirmAction?.message || ''}
                confirmLabel="実行する"
                cancelLabel="キャンセル"
                onConfirm={schedule.confirmAction?.onConfirm || (() => { })}
                onCancel={() => schedule.setConfirmAction(null)}
                isLoading={schedule.isActionExecuting}
                variant={schedule.confirmAction?.variant || 'info'}
            />

            <ShiftBackupModal
                isOpen={isBackupModalOpen}
                yearMonth={schedule.targetYearMonth}
                onClose={() => setIsBackupModalOpen(false)}
                onRestored={schedule.loadShifts}
            />

            <ShiftImportModal
                isOpen={isImportModalOpen}
                yearMonth={schedule.targetYearMonth}
                staffList={schedule.staffList}
                classes={schedule.classes}
                existingShifts={schedule.rawShifts}
                fixedDates={schedule.fixedDates}
                onClose={() => setIsImportModalOpen(false)}
                onImported={schedule.loadShifts}
            />

            <GenerationReportModal
                isOpen={schedule.isGenerationReportOpen}
                report={schedule.generationReport}
                onClose={() => schedule.setIsGenerationReportOpen(false)}
                onOpenDate={(date) => {
                    schedule.setIsGenerationReportOpen(false);
                    handleOpenTimeline(date);
                }}
            />
        </div>
    );
};

export default SchedulePage;
