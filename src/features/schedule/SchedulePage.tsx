import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, addWeeks, subMonths, subWeeks, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, type Locale } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { toast } from 'sonner';
import { Settings2, Download, AlertCircle, Loader2, Save, X, Trash2, ChevronLeft, ChevronRight, BarChart2, Lock, Unlock } from 'lucide-react';
import { getStaffList, getPreferencesByMonth, getShiftsByMonth, saveShiftsBatch, updateShift, deleteShiftsByMonth, getClasses, getRoles, getTimePatterns, getHolidays, syncHolidays, getShiftRequirements, getFixedDates, saveFixedDates } from '../../lib/api';
import { generateShiftsForMonth, isStaffAvailableReason } from '../../lib/algorithm';
import { exportToPDF } from '../../lib/exportUtils';
import { exportToExcelAdvanced } from '../../utils/excelExport';
import { saveActiveMonth, loadActiveMonth } from '../../utils/dateUtils';
import type { Shift, Staff, ShiftPreference, ShiftClass, ShiftTimePattern, Holiday, DynamicRole } from '../../types';
import DailyTimelineModal from './DailyTimelineModal';
import DailyTimelineView from './DailyTimelineView';
import WeeklyTimelineView from './WeeklyTimelineView';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StaffWorkHoursSummary from './components/StaffWorkHoursSummary';

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
    const [roles, setRoles] = useState<DynamicRole[]>([]); // 追加
    const [fixedDates, setFixedDates] = useState<Set<string>>(new Set());
    const [holidays, setHolidays] = useState<Holiday[]>([]); // 祝日データ（カレンダー表示・シフト生成に使用）
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

    const [currentDate, setCurrentDate] = useState(() => loadActiveMonth());
    const [view, setView] = useState<View>(Views.MONTH);

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'info';
    } | null>(null);
    const [isActionExecuting, setIsActionExecuting] = useState(false);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [mouseDownOnBackdrop, setMouseDownOnBackdrop] = useState(false);

    const handleBackdropMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setMouseDownOnBackdrop(true);
        }
    };

    const handleBackdropMouseUp = (e: React.MouseEvent, onClose: () => void) => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop) {
            onClose();
        }
        setMouseDownOnBackdrop(false);
    };

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
            } else if (view === Views.MONTH) {
                // 月間表示でも週の端（前後の月）を取得する
                const monthStart = startOfMonth(currentDate);
                const monthEnd = endOfMonth(currentDate);
                const weekStartOfFirstDay = startOfWeek(monthStart, { locale: ja, weekStartsOn: getWeekStartsOn() });
                const weekEndOfLastDay = addDays(startOfWeek(monthEnd, { locale: ja, weekStartsOn: getWeekStartsOn() }), 6);
                
                monthsToFetch.add(format(weekStartOfFirstDay, 'yyyy-MM'));
                monthsToFetch.add(format(weekEndOfLastDay, 'yyyy-MM'));
            }

            const monthList = Array.from(monthsToFetch);
            const yearList = monthList.map(m => parseInt(m.split('-')[0]));
            const uniqueYears = [...new Set(yearList)];

            // 祝日データを同期（今年と来年分）して、その後データを取得
            await syncHolidays().catch(err => console.error('Failed to sync holidays', err));

            const [shiftsResults, staffs, prefsResults, classesData, patternsData, holidaysData, rolesData, fixedDatesData] = await Promise.all([
                Promise.all(monthList.map(m => getShiftsByMonth(m))),
                getStaffList(),
                Promise.all(monthList.map(m => getPreferencesByMonth(m))),
                getClasses(),
                getTimePatterns(),
                // 対象年の祝日を取得
                getHolidays(uniqueYears[0] || new Date().getFullYear()),
                getRoles(), // 追加
                getFixedDates(targetYearMonth) // 追加
            ]);

            // 重複を除去して結合
            const combinedShifts = Array.from(new Map(shiftsResults.flat().map(v => [v.id, v])).values());
            const combinedPrefs = Array.from(new Map(prefsResults.flat().map(v => [v.id, v])).values());

            setRawShifts(combinedShifts);
            setStaffList(staffs);
            setPreferences(combinedPrefs);
            setClasses(classesData);
            setTimePatterns(patternsData);
            setHolidays(holidaysData);
            setRoles(rolesData); // 追加
            setFixedDates(new Set(fixedDatesData));
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
        saveActiveMonth(currentDate);
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
    const summaryEvents = useMemo(() => {
        if (view !== Views.MONTH) return events;

        const dailySummary: Record<string, { classes: Record<string, number>; insufficient: number; requestedOff: number; fixedOff: number }> = {};

        // シフトの集計
        events.forEach(event => {
            const dateStr = format(event.start, 'yyyy-MM-dd');
            if (!dailySummary[dateStr]) {
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, fixedOff: 0 };
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
                dailySummary[dateStr] = { classes: {}, insufficient: 0, requestedOff: 0, fixedOff: 0 };
            }

            staffList.forEach(staff => {
                const dayOfWeek = getDay(day);
                if (dayOfWeek === 0) return;

                // 1. 休日管理（希望休）のチェック - 終日・時間を問わず存在すればカウント
                const pref = preferences.find(p => p.staffId === staff.id);
                const hasPreference = pref && (
                    pref.unavailableDates.includes(dateStr) || 
                    (pref.details && pref.details.some(d => d.date === dateStr))
                );

                if (hasPreference) {
                    dailySummary[dateStr].requestedOff++;
                } else {
                    // 2. スタッフ管理の固定休日チェック
                    const reason = isStaffAvailableReason(staff, day, dateStr, preferences);
                    if (reason === 'fixed') {
                        dailySummary[dateStr].fixedOff++;
                    }
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
                    id: `summary-req-off-${dateStr}`,
                    title: `希望休: ${data.requestedOff}名`,
                    start: baseDate,
                    end: baseDate,
                    isSummary: true,
                    type: 'requested-off'
                });
            }

            // 固定休人数
            if (data.fixedOff > 0) {
                summaries.push({
                    id: `summary-fixed-off-${dateStr}`,
                    title: `固定休: ${data.fixedOff}名`,
                    start: baseDate,
                    end: baseDate,
                    isSummary: true,
                    type: 'fixed-off'
                });
            }
        });
        return summaries;
    }, [view, events, currentDate, staffList, preferences, classes]);

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
            const [staffs, prefs, roles, currentClasses, holidaysData, requirements] = await Promise.all([
                getStaffList(),
                getPreferencesByMonth(targetYearMonth),
                getRoles(),
                getClasses(),
                getHolidays(currentDate.getFullYear()),
                getShiftRequirements()
            ]);

            // 自動生成前に、前月や当月に既に確定しているシフトがあれば（固定シフトなどの将来的な拡張を考慮し）
            // コンテキストとして取得。ここでは単に直近前後の月のシフトを取得。
            const prevMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
            const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
            const existingContextShifts = await Promise.all([
                getShiftsByMonth(prevMonth),
                getShiftsByMonth(nextMonth)
            ]).then(results => results.flat());

            const fixedContextShifts = rawShifts.filter(s => s.date.startsWith(targetYearMonth) && fixedDates.has(s.date));
            const mergedContext = [...existingContextShifts, ...fixedContextShifts];

            await saveFixedDates(targetYearMonth, Array.from(fixedDates));
            await deleteShiftsByMonth(targetYearMonth, Array.from(fixedDates));
            const generatedShifts = generateShiftsForMonth(
                targetYearMonth,
                staffs,
                prefs,
                roles,
                currentClasses,
                holidaysData.map(h => h.date),
                requirements,
                mergedContext,
                Array.from(fixedDates)
            );
            const errCount = generatedShifts.filter(s => s.staffId === 'UNASSIGNED').length;

            await saveShiftsBatch(generatedShifts);
            await loadShifts();
            setConfirmAction(null);

            if (errCount > 0) {
                toast.warning(`自動生成完了: ${errCount}件の割り当て不足があります。`);
            } else {
                toast.success('シフトの自動生成が完了しました！');
            }
        } catch (err) {
            console.error(err);
            toast.error('シフト生成中にエラーが発生しました。');
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
            toast.success('保存しました');
            await loadShifts();
        } catch (err) {
            console.error(err);
            toast.error('保存に失敗しました。');
        }
    };

    const handleOpenTimeline = (date: Date) => {
        setSelectedDateForTimeline(date);
        setIsTimelineModalOpen(true);
    };

    const eventStyleGetter = (event: any) => {
        const style: any = {
            borderRadius: '4px',
            opacity: (view === Views.MONTH && !isSameMonth(event.start, currentDate)) ? 0.4 : 0.9,
            color: 'white',
            border: '0px',
            display: 'block',
            fontSize: '11px',
            padding: '2px 4px'
        };

        if (event.isError || event.type === 'error') {
            style.backgroundColor = '#94a3b8'; // Slate 400 (was Red)
        } else if (event.type === 'requested-off') {
            style.backgroundColor = '#ef4444'; // Red 500 (was Slate)
        } else if (event.type === 'fixed-off') {
            style.backgroundColor = '#cbd5e1'; // Slate 300
            style.color = '#475569'; // Slate 600 for better contrast on light bg
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

    // 祝日マップを作成（日付→祝日情報のマップ）
    const holidayMap = new Map(holidays.map(h => [h.date, h]));

    // 指定日の祝日名を取得
    const getHolidayNameForDate = (date: Date): string => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return holidayMap.get(dateStr)?.name || '';
    };

    // 指定日が祝日かどうか
    const isHolidayDate = (date: Date): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const holiday = holidayMap.get(dateStr);
        return holiday !== undefined && !holiday.isWorkday;
    };

    const toggleFixedDate = (dateStr: string) => {
        setFixedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr);
            else next.add(dateStr);
            // サーバーに即座に保存（ロック状態がloadShiftsで消えないように）
            saveFixedDates(targetYearMonth, Array.from(next)).catch(err =>
                console.error('Failed to save fixed dates', err)
            );
            return next;
        });
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
                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
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
                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setView(Views.MONTH)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${view === Views.MONTH ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                月
                            </button>
                            <button
                                onClick={() => setView(Views.WEEK)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${view === Views.WEEK ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                週
                            </button>
                            <button
                                onClick={() => setView(Views.DAY)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${view === Views.DAY ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                            >
                                日
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className={`flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center ${generating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700 hover:cursor-pointer'}`}
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
                                            toast.success('削除しました');
                                            setConfirmAction(null);
                                        } catch (err) {
                                            console.error(err);
                                            toast.error('削除に失敗しました。');
                                        } finally {
                                            setIsActionExecuting(false);
                                        }
                                    },
                                    variant: 'danger'
                                });
                            }}
                            className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center hover:cursor-pointer"
                        >
                            <Trash2 className="w-5 h-5 text-red-500" />
                            <span className="whitespace-nowrap">消去</span>
                        </button>

                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                                className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl shadow-sm transition-all flex-1 cursor-pointer ${isSummaryOpen
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                                title="スタッフ別労働時間を表示"
                            >
                                <BarChart2 className={`w-5 h-5 ${isSummaryOpen ? 'text-white' : 'text-indigo-500'}`} />
                                <span className="hidden sm:inline text-sm font-bold whitespace-nowrap">労働時間</span>
                            </button>
                            <button
                                onClick={() => exportToExcelAdvanced(targetYearMonth, staffList, rawShifts, classes, timePatterns)}
                                className="flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors flex-1 cursor-pointer"
                            >
                                <Download className="w-5 h-5 text-green-600" />
                                <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">Excel</span>
                            </button>
                            <button
                                onClick={() => exportToPDF(targetYearMonth, staffList, rawShifts)}
                                className="flex items-center justify-center space-x-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2.5 rounded-xl shadow-sm transition-colors flex-1 cursor-pointer"
                            >
                                <Download className="w-5 h-5 text-red-600" />
                                <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">PDF</span>
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

            {/* Calendar and Summary Area - Scrollable */}
            <div className="flex-1 overflow-hidden px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 flex flex-col lg:flex-row gap-4">
                <div className="flex-1 h-full min-w-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-2 sm:p-4 relative flex flex-col overflow-hidden">
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
                                    roles={roles}
                                    preferences={preferences}
                                    onShiftUpdate={loadShifts}
                                    onModifiedChange={setIsDayModified}
                                    saveRef={daySaveRef}
                                    isFixed={fixedDates.has(format(currentDate, 'yyyy-MM-dd'))}
                                    onToggleFixed={() => toggleFixedDate(format(currentDate, 'yyyy-MM-dd'))}
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
                        ) : view === Views.WEEK ? (
                            <div className="flex-1 overflow-hidden">
                                <WeeklyTimelineView
                                    startDate={currentDate}
                                    shifts={rawShifts}
                                    staffList={staffList}
                                    classes={classes}
                                    timePatterns={timePatterns}
                                    roles={roles}
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
                                        month: {
                                            dateHeader: (props: any) => {
                                                const dateStr = format(props.date, 'yyyy-MM-dd');
                                                const isFixed = fixedDates.has(dateStr);
                                                return (
                                                    <div className="flex justify-between items-center w-full px-1 py-0.5">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                toggleFixedDate(dateStr);
                                                            }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                            onDoubleClick={(e) => e.stopPropagation()}
                                                            className={`p-1 flex items-center justify-center rounded transition-colors ${isFixed ? 'text-red-500 bg-red-100 hover:bg-red-200' : 'text-slate-300 hover:text-slate-700 hover:bg-slate-200/50'}`}
                                                            title={isFixed ? '自動生成からロック中' : 'シフトをロックする'}
                                                        >
                                                            {isFixed ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                        </button>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 pr-1">{props.label}</span>
                                                    </div>
                                                );
                                            }
                                        },
                                        dateCellWrapper: (props: any) => {
                                            const date = props.value;
                                            const holidayName = getHolidayNameForDate(date);
                                            const isHoliday = isHolidayDate(date);
                                            const dayOfWeek = getDay(date); // 0: 日, 1: 月, ..., 6: 土

                                            // 日曜日または祝日は赤、土曜日は青、それ以外は背景色なし
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
                                                    {holidayName && (
                                                        <div className="text-xs text-red-600 dark:text-red-400 font-medium px-1 py-0.5 truncate">
                                                            {holidayName}
                                                        </div>
                                                    )}
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
                                        agenda: "予定"
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Staff Work Hours Summary Side Panel (Desktop only side-by-side) */}
                <div className="hidden lg:block">
                    <StaffWorkHoursSummary
                        staffs={staffList}
                        shifts={rawShifts}
                        isOpen={isSummaryOpen}
                        viewDate={currentDate}
                    />
                </div>
            </div>

            {/* Staff Work Hours Summary (Overlay for Mobile/Tablet) */}
            <div className="lg:hidden">
                {isSummaryOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
                        onMouseDown={handleBackdropMouseDown}
                        onMouseUp={(e) => handleBackdropMouseUp(e, () => setIsSummaryOpen(false))}
                    >
                        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-slate-800 animate-in slide-in-from-right duration-300" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            <div className="h-full flex flex-col">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 dark:text-white">労働時間サマリー</h3>
                                    <button onClick={() => setIsSummaryOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <StaffWorkHoursSummary
                                        staffs={staffList}
                                        shifts={rawShifts}
                                        isOpen={true}
                                        viewDate={currentDate}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Shift Edit Modal */}
            {isEditModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    onMouseDown={handleBackdropMouseDown}
                    onMouseUp={(e) => handleBackdropMouseUp(e, () => setIsEditModalOpen(false))}
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
                    roles={roles}
                    preferences={preferences}
                    onClose={() => setIsTimelineModalOpen(false)}
                    onShiftUpdate={loadShifts}
                    isFixed={fixedDates.has(format(selectedDateForTimeline, 'yyyy-MM-dd'))}
                    onToggleFixed={() => toggleFixedDate(format(selectedDateForTimeline, 'yyyy-MM-dd'))}
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
