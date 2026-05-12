import { useState, useCallback, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { useCalendarInteractions } from './hooks/useCalendarInteractions';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View, type DateHeaderProps, type DateCellWrapperProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, type Locale } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { toast } from 'sonner';
import { Loader2, Save, Lock, Unlock } from 'lucide-react';
import DailyTimelineModal from './DailyTimelineModal';
import DailyTimelineView from './DailyTimelineView';
import WeeklyTimelineView from './WeeklyTimelineView';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StaffWorkHoursSummary from './components/StaffWorkHoursSummary';
import ScheduleHeader from './components/ScheduleHeader';
import ShiftEditModal from './components/ShiftEditModal';
import MobileWorkHoursPanel from './components/MobileWorkHoursPanel';
import ShiftBackupModal from './components/ShiftBackupModal';
import GenerateReportModal from './components/GenerateReportModal';
import ShiftImportModal from './components/ShiftImportModal';
import { useScheduleData, type CalendarEvent, type EditFormData } from './hooks/useScheduleData';
import { getWeekStartsOn } from '../../utils/dateUtils';
import { UNASSIGNED_STAFF_ID } from '../../constants';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date, options?: { locale?: Locale }) => startOfWeek(date, { ...options, weekStartsOn: getWeekStartsOn() }),
    getDay,
    locales: { 'ja': ja },
});

const SchedulePage = () => {
    const schedule = useScheduleData();

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
    const calendarComponents = useMemo(() => ({
        toolbar: () => null,
        month: {
            dateHeader: (props: DateHeaderProps) => {
                const dateStr = format(props.date, 'yyyy-MM-dd');
                const isFixed = fixedDates.has(dateStr);
                const holidayName = getHolidayNameForDate(props.date);
                const openTimeline = () => {
                    if (Date.now() - lastTouchOpenRef.current < 500) return;
                    handleOpenTimeline(props.date);
                };
                return (
                    <div
                        role="button"
                        tabIndex={0}
                        className="flex justify-between items-center w-full px-1 py-0.5 cursor-pointer"
                        onClick={openTimeline}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTimeline(); } }}
                    >
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFixedDate(dateStr);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            className={`p-1 hidden sm:flex items-center justify-center rounded transition-colors shrink-0 ${isFixed ? 'text-red-500 bg-red-100 hover:bg-red-200' : 'text-slate-300 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            title={isFixed ? '自動生成からロック中' : 'シフトをロックする'}
                            aria-label={isFixed ? 'シフトのロックを解除する' : 'シフトをロックする'}
                        >
                            {isFixed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>
                        {holidayName && (
                            <span className="hidden sm:inline text-xs text-red-600 dark:text-red-400 font-medium truncate flex-1 text-center px-1" title={holidayName}>
                                {holidayName}
                            </span>
                        )}
                        <span className="font-medium text-slate-700 dark:text-slate-300 pr-1 shrink-0">{props.label}</span>
                    </div>
                );
            },
        },
        dateCellWrapper: (props: DateCellWrapperProps) => {
            const date = props.value;
            const isHoliday = isHolidayDate(date);
            const dayOfWeek = getDay(date);
            let bgColorClass = '';
            if (dayOfWeek === 0 || isHoliday) {
                bgColorClass = 'bg-red-50 dark:bg-red-900/10';
            } else if (dayOfWeek === 6) {
                bgColorClass = 'bg-blue-50 dark:bg-blue-900/10';
            }
            return (
                <div className={`rbc-day-bg ${bgColorClass}`} style={{ height: '100%' }}>
                    {props.children}
                </div>
            );
        },
    }), [fixedDates, getHolidayNameForDate, isHolidayDate, toggleFixedDate, handleOpenTimeline, lastTouchOpenRef]);

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
                onDateChange={schedule.setCurrentDate}
                onViewChange={schedule.setView}
                onGenerate={schedule.handleGenerate}
                onClearShifts={schedule.handleClearShifts}
                onOpenBackups={() => setIsBackupModalOpen(true)}
                onOpenImport={() => setIsImportModalOpen(true)}
                onToggleSummary={() => setIsSummaryOpen(!isSummaryOpen)}
                onRetry={schedule.loadShifts}
                onErrorDateClick={handleOpenTimeline}
                businessHours={schedule.businessHours}
                excelSettings={schedule.excelSettings}
                breakSettings={schedule.breakSettings}
                roles={schedule.roles}
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
                                        onClick={() => schedule.loadShifts()}
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
                                    onView={(v) => schedule.setView(v as View)}
                                    date={schedule.currentDate}
                                    onNavigate={(newDate) => schedule.setCurrentDate(newDate)}
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
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
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

            <GenerateReportModal
                isOpen={schedule.generateReport !== null}
                onClose={() => schedule.setGenerateReport(null)}
                reportData={schedule.generateReport}
                staffList={schedule.staffList}
                classes={schedule.classes}
                breakSettings={schedule.breakSettings}
            />
        </div>
    );
};

export default SchedulePage;
