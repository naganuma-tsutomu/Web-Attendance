import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
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
import { useScheduleData, type CalendarEvent, type EditFormData } from './hooks/useScheduleData';

const getWeekStartsOn = (): 0 | 1 => {
    return (parseInt(localStorage.getItem('weekStartsOn') || '0') as 0 | 1);
};

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
    const [calendarKey, setCalendarKey] = useState(0);

    // リサイズ時にカレンダーキーを更新して高さを再計算
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => setCalendarKey(prev => prev + 1), 150);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    const handleOpenTimeline = (date: Date) => {
        setSelectedDateForTimeline(date);
        setIsTimelineModalOpen(true);
    };

    const handleEventSelect = (event: CalendarEvent) => {
        setSelectedEvent(event);
        const shift = schedule.rawShifts.find(s => s.id === event.id);
        if (shift) {
            setEditFormData({
                staffId: shift.staffId === 'UNASSIGNED' ? '' : shift.staffId,
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

    // バックドロップクリックでモーダルを閉じるためのヘルパー
    const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = useState(false);
    const handleBackdropMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) setMouseDownOnBackdrop(true);
    };
    const handleBackdropMouseUp = (e: React.MouseEvent, onClose: () => void) => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop) onClose();
        setMouseDownOnBackdrop(false);
    };

    return (
        <div className="h-full flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 max-w-7xl mx-auto w-full">
            {/* Header Area */}
            <ScheduleHeader
                currentDate={schedule.currentDate}
                view={schedule.view}
                generating={schedule.generating}
                errorCount={schedule.errorCount}
                loadError={schedule.loadError}
                isSummaryOpen={isSummaryOpen}
                targetYearMonth={schedule.targetYearMonth}
                staffList={schedule.staffList}
                rawShifts={schedule.rawShifts}
                classes={schedule.classes}
                timePatterns={schedule.timePatterns}
                onDateChange={schedule.setCurrentDate}
                onViewChange={schedule.setView}
                onGenerate={schedule.handleGenerate}
                onClearShifts={schedule.handleClearShifts}
                onToggleSummary={() => setIsSummaryOpen(!isSummaryOpen)}
                onRetry={schedule.loadShifts}
                businessHours={schedule.businessHours}
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
                                />
                                {schedule.isDayModified && (
                                    <div className="mt-4 flex-shrink-0 flex items-center justify-end gap-3 animate-in slide-in-from-bottom-2 pb-2">
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
                                            保存する
                                        </button>
                                    </div>
                                )}
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
                                    onDateClick={(date) => handleOpenTimeline(date)}
                                />
                            </div>
                        ) : (
                            <div className="h-full rb-calendar-container overflow-hidden">
                                <BigCalendar
                                    key={calendarKey}
                                    localizer={localizer}
                                    events={schedule.summaryEvents}
                                    startAccessor="start"
                                    endAccessor="end"
                                    culture="ja"
                                    selectable={true}
                                    onSelectSlot={({ start }) => handleOpenTimeline(start as Date)}
                                    eventPropGetter={schedule.eventStyleGetter}
                                    onSelectEvent={(event: any) => {
                                        if (event.isSummary) {
                                            handleOpenTimeline(event.start);
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
                                    components={{
                                        toolbar: () => null,
                                        month: {
                                            dateHeader: (props: any) => {
                                                const dateStr = format(props.date, 'yyyy-MM-dd');
                                                const isFixed = schedule.fixedDates.has(dateStr);
                                                const holidayName = schedule.getHolidayNameForDate(props.date);
                                                return (
                                                    <div
                                                        className="flex justify-between items-center w-full px-1 py-0.5 cursor-pointer"
                                                        onClick={() => handleOpenTimeline(props.date)}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                schedule.toggleFixedDate(dateStr);
                                                            }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                            onDoubleClick={(e) => e.stopPropagation()}
                                                            className={`p-1 flex items-center justify-center rounded transition-colors shrink-0 ${isFixed ? 'text-red-500 bg-red-100 hover:bg-red-200' : 'text-slate-300 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                                            title={isFixed ? '自動生成からロック中' : 'シフトをロックする'}
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
                                            }
                                        },
                                        dateCellWrapper: (props: any) => {
                                            const date = props.value;
                                            const isHoliday = schedule.isHolidayDate(date);
                                            const dayOfWeek = getDay(date);

                                            let bgColorClass = '';
                                            if (dayOfWeek === 0 || isHoliday) {
                                                bgColorClass = 'bg-red-50 dark:bg-red-900/10';
                                            } else if (dayOfWeek === 6) {
                                                bgColorClass = 'bg-blue-50 dark:bg-blue-900/10';
                                            }

                                            return (
                                                <div
                                                    className={`rbc-day-bg ${bgColorClass}`}
                                                    style={{ height: '100%' }}
                                                >
                                                    {props.children}
                                                </div>
                                            );
                                        }
                                    }}
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
            {isEditModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    onMouseDown={handleBackdropMouseDown}
                    onMouseUp={(e) => handleBackdropMouseUp(e, () => setIsEditModalOpen(false))}
                >
                    <ShiftEditModal
                        selectedEvent={selectedEvent}
                        editFormData={editFormData}
                        currentDate={schedule.currentDate}
                        staffList={schedule.staffList}
                        onFormChange={setEditFormData}
                        onSubmit={handleUpdateShift}
                        onClose={() => setIsEditModalOpen(false)}
                    />
                </div>
            )}

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
        </div>
    );
};

export default SchedulePage;
