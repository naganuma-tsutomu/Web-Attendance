import { useState, useEffect, useRef } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, addWeeks, subMonths, subWeeks, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, type Locale } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Settings2, Download, Plus, AlertCircle, Loader2, Save, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStaffList, getPreferencesByMonth, getShiftsByMonth, saveShiftsBatch, updateShift, deleteShiftsByMonth, getClasses, getRoles, getTimePatterns } from '../../lib/api';
import { generateShiftsForMonth, isStaffAvailable } from '../../lib/algorithm';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';
import type { Shift, Staff, ShiftPreference, ShiftClass, ShiftTimePattern } from '../../types';
import DailyTimelineModal from './DailyTimelineModal';
import DailyTimelineView from './DailyTimelineView';
import WeeklyTimelineView from './WeeklyTimelineView';
import ConfirmModal from '../../components/ui/ConfirmModal';

const locales = {
    'ja': ja,
};

const getWeekStartsOn = (): 0 | 1 => {
    return (parseInt(localStorage.getItem('weekStartsOn') || '0') as 0 | 1);
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date, options?: { locale?: Locale }) => startOfWeek(date, { ...options, weekStartsOn: getWeekStartsOn() }),
    getDay,
    locales,
});

// カレンダーイベントの型定義
interface CalendarEvent {
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
}

// 編集フォームの型定義
interface EditFormData {
    staffId: string;
    date: string;
    startTime: string;
    endTime: string;
}

const SchedulePage = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [errorCount, setErrorCount] = useState(0);
    const [rawShifts, setRawShifts] = useState<Shift[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [preferences, setPreferences] = useState<ShiftPreference[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [editFormData, setEditFormData] = useState<EditFormData>({
        staffId: '',
        date: '',
        startTime: '',
        endTime: ''
    });

    const [isDayModified, setIsDayModified] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const daySaveRef = useRef<(() => Promise<void>) | null>(null);

    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
    const [selectedDateForTimeline, setSelectedDateForTimeline] = useState<Date | null>(null);

    const [currentDate, setCurrentDate] = useState(addMonths(new Date(), 1));
    const [view, setView] = useState<View>(Views.MONTH);

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
    } | null>(null);
    const [isActionExecuting, setIsActionExecuting] = useState(false);

    const targetYearMonth = format(currentDate, 'yyyy-MM');

    // Load shifts from DB
    const loadShifts = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const monthsToFetch = new Set<string>();
            monthsToFetch.add(format(currentDate, 'yyyy-MM'));

            if (view === Views.WEEK) {
                const weekStart = startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() });
                const weekEnd = addDays(weekStart, 6);
                monthsToFetch.add(format(weekStart, 'yyyy-MM'));
                monthsToFetch.add(format(weekEnd, 'yyyy-MM'));
            }

            const monthList = Array.from(monthsToFetch);
            const [shiftsResults, staffs, prefsResults, classesData, patternsData] = await Promise.all([
                Promise.all(monthList.map(m => getShiftsByMonth(m))),
                getStaffList(),
                Promise.all(monthList.map(m => getPreferencesByMonth(m))),
                getClasses(),
                getTimePatterns()
            ]);

            // 重複を除去して結合
            const combinedShifts = shiftsResults.flat().filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            const combinedPrefs = prefsResults.flat().filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

            setRawShifts(combinedShifts);
            setStaffList(staffs);
            setPreferences(combinedPrefs);
            setClasses(classesData);
            setTimePatterns(patternsData);
            mapShiftsToEvents(combinedShifts, staffs, classesData);
        } catch (err) {
            console.error('Failed to load shifts', err);
            setLoadError('シフトデータの読み込みに失敗しました。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadShifts();
    }, [currentDate, view]);

    const mapShiftsToEvents = (shifts: Shift[], staffs: Staff[], currentClasses: ShiftClass[]) => {
        let errCount = 0;
        const calendarEvents: CalendarEvent[] = shifts.map(shift => {
            if (shift.isError) errCount++;
            const staff = staffs.find(s => s.id === shift.staffId);
            const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');

            const shiftClass = currentClasses.find(c => c.id === shift.classType);
            const className = shiftClass ? shiftClass.name : shift.classType;

            let titleSuffix = '';
            if (shift.isError) titleSuffix = '(エラー)';
            else if (className === '特殊' || className === 'ヘルプ') titleSuffix = '(ヘルプ)';
            else titleSuffix = shift.isEarlyShift ? '(早番)' : '(遅番)';

            return {
                id: shift.id,
                title: `${staffName}${titleSuffix}`,
                start: new Date(`${shift.date}T${shift.startTime}:00`),
                end: new Date(`${shift.date}T${shift.endTime}:00`),
                resourceId: shift.classType,
                isError: shift.isError ?? false,
                isEarly: shift.isEarlyShift,
                classNameValue: className
            };
        });
        setEvents(calendarEvents);
        setErrorCount(errCount);
    };

    // 月間表示用のサマリーイベントを生成
    const summaryEvents = view === Views.MONTH ? (() => {
        const dailySummary: Record<string, { classes: Record<string, number>; insufficient: number; requestedOff: number }> = {};

        // シフトの集計
        events.forEach(event => {
            const dateStr = format(event.start, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0 };
            }

            if (event.isError) {
                dailySummary[dateStr].insufficient++;
            } else {
                const className = event.classNameValue || 'その他';
                dailySummary[dateStr].classes[className] = (dailySummary[dateStr].classes[className] || 0) + 1;
            }
        });

        // 希望休・固定休日の集計
        const startDate = startOfMonth(currentDate);
        const endDate = endOfMonth(currentDate);
        const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

        daysInMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0 };
            }

            staffList.forEach(staff => {
                // その日が「平日または土曜」である場合に限り、休み（利用不可）をチェック
                // (日曜はもともと休みなのでカウントしない)
                const dayOfWeek = getDay(day);
                if (dayOfWeek === 0) return;

                if (!isStaffAvailable(staff, day, dateStr, preferences)) {
                    dailySummary[dateStr].requestedOff++;
                }
            });
        });

        const summaries: any[] = [];
        Object.entries(dailySummary).forEach(([dateStr, data]) => {
            const baseDate = new Date(`${dateStr}T00:00:00`);

            // クラス別人数 (classes 配列の順序に従う)
            classes.forEach(cls => {
                const count = data.classes[cls.name];
                if (count > 0) {
                    summaries.push({
                        id: `summary-class-${cls.id}-${dateStr}`,
                        title: `${cls.name}: ${count}名`,
                        start: baseDate,
                        end: baseDate,
                        isSummary: true,
                        type: 'class',
                        classNameValue: cls.name
                    });
                }
            });

            // 不足人数
            if (data.insufficient > 0) {
                summaries.push({
                    id: `summary-insufficient-${dateStr}`,
                    title: `不足: ${data.insufficient}名`,
                    start: baseDate,
                    end: baseDate,
                    isSummary: true,
                    isError: true,
                    type: 'error'
                });
            }

            // 希望休人数
            if (data.requestedOff > 0) {
                summaries.push({
                    id: `summary-off-${dateStr}`,
                    title: `希望休: ${data.requestedOff}名`,
                    start: baseDate,
                    end: baseDate,
                    isSummary: true,
                    type: 'off'
                });
            }
        });
        return summaries;
    })() : events;

    const handleGenerate = () => {
        setConfirmAction({
            title: 'シフトの自動生成',
            message: `${format(currentDate, 'yyyy年M月')} のシフトを自動生成します。既存のシフトは上書きされます。よろしいですか？`,
            onConfirm: executeGenerate,
            variant: 'info'
        });
    };

    const executeGenerate = async () => {
        setIsActionExecuting(true);
        setGenerating(true);
        try {
            const [staffs, prefs, roles, holidays, currentClasses] = await Promise.all([
                getStaffList(),
                getPreferencesByMonth(targetYearMonth),
                getRoles(),
                [], // TODO: 休祝日の取得
                getClasses()
            ]);

            await deleteShiftsByMonth(targetYearMonth);
            const generatedShifts = generateShiftsForMonth(targetYearMonth, staffs, prefs, roles, currentClasses, holidays);
            const errCount = generatedShifts.filter(s => s.staffId === 'UNASSIGNED').length;

            await saveShiftsBatch(generatedShifts);
            await loadShifts();
            setConfirmAction(null);

            if (errCount > 0) {
                alert(`シフトの自動生成が完了しましたが、${errCount}件の割り当て不足が発生しました。手動で調整してください。`);
            } else {
                alert('シフトの自動生成が完了しました！');
            }
        } catch (err) {
            console.error(err);
            alert('シフト生成中にエラーが発生しました。');
        } finally {
            setGenerating(false);
            setIsActionExecuting(false);
        }
    };

    const handleEventSelect = (event: CalendarEvent) => {
        setSelectedEvent(event);
        const shift = rawShifts.find(s => s.id === event.id);
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
            if (selectedEvent) {
                // 既存シフトの更新
                await updateShift(selectedEvent.id, {
                    staffId: editFormData.staffId || 'UNASSIGNED',
                    startTime: editFormData.startTime,
                    endTime: editFormData.endTime,
                    isError: editFormData.staffId === ''
                });
            } else {
                // 新規追加（日付選択フィールドを使用）
                const dateStr = editFormData.date || format(currentDate, 'yyyy-MM-01');
                await saveShiftsBatch([{
                    date: dateStr,
                    staffId: editFormData.staffId || 'UNASSIGNED',
                    startTime: editFormData.startTime,
                    endTime: editFormData.endTime,
                    classType: classes[0]?.id || 'class_niji',
                    isEarlyShift: false,
                    isError: editFormData.staffId === ''
                }]);
            }
            setIsEditModalOpen(false);
            await loadShifts();
        } catch (err) {
            console.error(err);
            alert('保存に失敗しました。');
        }
    };

    const handleOpenTimeline = (date: Date) => {
        setSelectedDateForTimeline(date);
        setIsTimelineModalOpen(true);
    };

    const eventStyleGetter = (event: any) => {
        let style: any = {
            borderRadius: '4px',
            opacity: 0.9,
            color: 'white',
            border: '0px',
            display: 'block',
            fontSize: '11px',
            padding: '2px 4px'
        };

        if (event.isError || event.type === 'error') {
            style.backgroundColor = '#ef4444';
        } else if (event.type === 'off') {
            style.backgroundColor = '#94a3b8'; // Slate 400
        } else if (event.type === 'class') {
            const clsName = event.classNameValue;
            if (clsName === '虹組') style.backgroundColor = '#f59e0b'; // Amber 500
            else if (clsName === 'スマイル組') style.backgroundColor = '#3b82f6'; // Blue 500
            else if (clsName === '特殊' || clsName === 'ヘルプ') style.backgroundColor = '#10b981'; // Emerald 500
            else style.backgroundColor = '#6366f1'; // Indigo 500
        } else if (event.isEarly) {
            style.backgroundColor = '#3b82f6';
        } else {
            style.backgroundColor = '#f59e0b';
        }

        style.cursor = 'pointer';

        return { style };
    };

    return (
        <div className="h-full flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50 max-w-7xl mx-auto w-full">
            {/* Header Area - Fixed */}
            <div className="flex-shrink-0 p-4 sm:p-6 md:p-8 pb-4 md:pb-4 space-y-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
                            <button
                                onClick={() => {
                                    if (view === Views.MONTH) setCurrentDate(subMonths(currentDate, 1));
                                    else if (view === Views.WEEK) setCurrentDate(subWeeks(currentDate, 1));
                                    else setCurrentDate(subDays(currentDate, 1));
                                }}
                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                            <div className="px-3 py-1.5 font-bold text-slate-800 dark:text-white min-w-[120px] text-center">
                                {view === Views.MONTH
                                    ? format(currentDate, 'yyyy年M月', { locale: ja })
                                    : view === Views.WEEK
                                        ? `${format(startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() }), 'M/d')} - ${format(addDays(startOfWeek(currentDate, { locale: ja, weekStartsOn: getWeekStartsOn() }), 6), 'M/d')}`
                                        : format(currentDate, 'M月d日(E)', { locale: ja })
                                }
                            </div>
                            <button
                                onClick={() => {
                                    if (view === Views.MONTH) setCurrentDate(addMonths(currentDate, 1));
                                    else if (view === Views.WEEK) setCurrentDate(addWeeks(currentDate, 1));
                                    else setCurrentDate(addDays(currentDate, 1));
                                }}
                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setView(Views.MONTH)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${view === Views.MONTH ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                月
                            </button>
                            <button
                                onClick={() => setView(Views.WEEK)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${view === Views.WEEK ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                週
                            </button>
                            <button
                                onClick={() => setView(Views.DAY)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${view === Views.DAY ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                日
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className={`flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center ${generating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                        >
                            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings2 className="w-5 h-5" />}
                            <span className="whitespace-nowrap">{generating ? '生成中...' : '自動生成'}</span>
                        </button>
                        <button
                            onClick={() => {
                                setConfirmAction({
                                    title: 'シフトの消去',
                                    message: 'この月のシフトをすべて削除してよろしいですか？',
                                    onConfirm: async () => {
                                        setIsActionExecuting(true);
                                        try {
                                            await deleteShiftsByMonth(targetYearMonth);
                                            await loadShifts();
                                            setConfirmAction(null);
                                        } catch (err) {
                                            console.error(err);
                                            alert('削除に失敗しました。');
                                        } finally {
                                            setIsActionExecuting(false);
                                        }
                                    },
                                    variant: 'danger'
                                });
                            }}
                            className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center"
                        >
                            <Trash2 className="w-5 h-5 text-red-500" />
                            <span className="whitespace-nowrap">消去</span>
                        </button>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => exportToExcel(targetYearMonth, staffList, rawShifts)}
                                className="flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors flex-1"
                            >
                                <Download className="w-5 h-5 text-green-600" />
                                <span className="sm:hidden lg:inline text-xs font-bold">Excel</span>
                            </button>
                            <button
                                onClick={() => exportToPDF(targetYearMonth, staffList, rawShifts)}
                                className="flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors flex-1"
                            >
                                <Download className="w-5 h-5 text-red-600" />
                                <span className="sm:hidden lg:inline text-xs font-bold">PDF</span>
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedEvent(null);
                                    setEditFormData({
                                        staffId: '',
                                        date: format(currentDate, 'yyyy-MM-01'),
                                        startTime: '09:00',
                                        endTime: '18:00'
                                    });
                                    setIsEditModalOpen(true);
                                }}
                                className="flex items-center justify-center space-x-2 bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-[2] sm:flex-none"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="whitespace-nowrap font-bold">追加</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Warning Banner */}
                {errorCount > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm border-l-2 border-red-500 pl-3">
                            <p className="text-red-900 dark:text-red-200 font-medium">シフトエラーがあります ({errorCount}件)</p>
                        </div>
                    </div>
                )}

                {/* Error Banner with Retry */}
                {loadError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in" role="alert">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-red-900 dark:text-red-200 font-medium">{loadError}</p>
                        </div>
                        <button
                            onClick={loadShifts}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            aria-label="再試行"
                        >
                            <Loader2 className="w-4 h-4" />
                            再試行
                        </button>
                    </div>
                )}
            </div>

            {/* Calendar Area - Scrollable */}
            <div className="flex-1 overflow-hidden px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
                <div className="h-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-2 sm:p-4 relative flex flex-col overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        </div>
                    )}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {view === Views.DAY ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <DailyTimelineView
                                    date={currentDate}
                                    shifts={rawShifts}
                                    staffList={staffList}
                                    classes={classes}
                                    timePatterns={timePatterns}
                                    onShiftUpdate={loadShifts}
                                    onModifiedChange={setIsDayModified}
                                    saveRef={daySaveRef}
                                />
                                {isDayModified && (
                                    <div className="mt-4 flex-shrink-0 flex items-center justify-end gap-3 animate-in slide-in-from-bottom-2 pb-2">
                                        <div className="hidden sm:flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mr-2 text-xs">
                                            <Save className="w-4 h-4" />
                                            <span>未保存の変更があります</span>
                                        </div>
                                        <button
                                            onClick={() => loadShifts()}
                                            className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                                        >
                                            破棄
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (daySaveRef.current) {
                                                    try {
                                                        await daySaveRef.current();
                                                        alert('保存しました');
                                                    } catch (e) {
                                                        alert('保存に失敗しました');
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
                        ) : view === Views.WEEK ? (
                            <div className="flex-1 overflow-hidden">
                                <WeeklyTimelineView
                                    startDate={currentDate}
                                    shifts={rawShifts}
                                    staffList={staffList}
                                    classes={classes}
                                    timePatterns={timePatterns}
                                    onDateClick={(date) => {
                                        handleOpenTimeline(date);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="h-full rb-calendar-container overflow-auto">
                                <BigCalendar
                                    localizer={localizer}
                                    events={summaryEvents}
                                    startAccessor="start"
                                    endAccessor="end"
                                    culture="ja"
                                    selectable={true}
                                    onSelectSlot={({ start }) => handleOpenTimeline(start as Date)}
                                    eventPropGetter={eventStyleGetter}
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
                                    view={view}
                                    onView={(v) => setView(v as View)}
                                    date={currentDate}
                                    onNavigate={(newDate) => setCurrentDate(newDate)}
                                    onDrillDown={(date) => {
                                        handleOpenTimeline(date);
                                    }}
                                    components={{
                                        toolbar: () => null,
                                    }}
                                    messages={{
                                        next: "次",
                                        previous: "前",
                                        today: "今日",
                                        month: "月",
                                        week: "週",
                                        day: "日",
                                        agenda: "予定"
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Edit Modal */}
            {isEditModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsEditModalOpen(false);
                    }}
                >
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {selectedEvent ? 'シフトの修正' : '予定の新規追加'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateShift} className="p-6 space-y-4">
                            {!selectedEvent && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">日付</label>
                                    <input
                                        type="date"
                                        required
                                        value={editFormData.date}
                                        min={format(currentDate, 'yyyy-MM-01')}
                                        max={format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd')}
                                        onChange={e => setEditFormData({ ...editFormData, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">担当スタッフ</label>
                                <select
                                    value={editFormData.staffId}
                                    onChange={e => setEditFormData({ ...editFormData, staffId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="">未割り当て</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">開始時間</label>
                                    <input
                                        type="time"
                                        required
                                        value={editFormData.startTime}
                                        onChange={e => setEditFormData({ ...editFormData, startTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">終了時間</label>
                                    <input
                                        type="time"
                                        required
                                        value={editFormData.endTime}
                                        onChange={e => setEditFormData({ ...editFormData, endTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors text-sm font-medium flex items-center justify-center space-x-2"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>保存する</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Daily Timeline Modal */}
            {isTimelineModalOpen && selectedDateForTimeline && (
                <DailyTimelineModal
                    date={selectedDateForTimeline}
                    shifts={rawShifts}
                    staffList={staffList}
                    classes={classes}
                    timePatterns={timePatterns}
                    onClose={() => setIsTimelineModalOpen(false)}
                    onShiftUpdate={loadShifts}
                />
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!confirmAction}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                confirmLabel="実行する"
                cancelLabel="キャンセル"
                onConfirm={confirmAction?.onConfirm || (() => { })}
                onCancel={() => setConfirmAction(null)}
                isLoading={isActionExecuting}
                variant={confirmAction?.variant || 'info'}
            />
        </div>
    );
};

export default SchedulePage;
