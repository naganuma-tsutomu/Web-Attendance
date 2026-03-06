import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Settings2, Download, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { getStaffList, getPreferencesByMonth, getShiftsByMonth, saveShiftsBatch } from '../../lib/api';
import { generateShiftsForMonth } from '../../lib/algorithm';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';
import type { Shift, Staff } from '../../types';

const locales = {
    'ja': ja,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const SchedulePage = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [errorCount, setErrorCount] = useState(0);
    const [rawShifts, setRawShifts] = useState<Shift[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);

    const nextMonthDate = addMonths(new Date(), 1);
    const targetYearMonth = format(nextMonthDate, 'yyyy-MM');

    // Load shifts from DB
    const loadShifts = async () => {
        setLoading(true);
        try {
            const shifts = await getShiftsByMonth(targetYearMonth);
            const staffs = await getStaffList();

            setRawShifts(shifts);
            setStaffList(staffs);
            mapShiftsToEvents(shifts, staffs);
        } catch (err) {
            console.error('Failed to load shifts', err);
            // Ignore for demo if DB is not connected
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadShifts();
    }, []);

    const mapShiftsToEvents = (shifts: Shift[], staffList: Staff[]) => {
        let errCount = 0;
        const calendarEvents = shifts.map(shift => {
            if (shift.isError) errCount++;
            const staff = staffList.find(s => s.id === shift.staffId);
            const staffName = staff ? staff.name : (shift.isError ? '未割り当て' : '不明');

            let titleSuffix = '';
            if (shift.isError) titleSuffix = '(エラー)';
            else if (shift.classType === '特殊') titleSuffix = '(ヘルプ)';
            else titleSuffix = shift.isEarlyShift ? '(早番)' : '(遅番)';

            return {
                id: shift.id,
                title: `${staffName} ${titleSuffix}`,
                start: new Date(`${shift.date}T${shift.startTime}:00`),
                end: new Date(`${shift.date}T${shift.endTime}:00`),
                resourceId: shift.classType,
                isError: shift.isError,
                isEarly: shift.isEarlyShift
            };
        });
        setEvents(calendarEvents);
        setErrorCount(errCount);
    };

    const handleGenerate = async () => {
        if (!window.confirm(`${format(nextMonthDate, 'yyyy年M月')}のシフトを自動生成します。よろしいですか？`)) return;

        setGenerating(true);
        try {
            // 1. Fetch staff and preferences
            const staffList = await getStaffList();
            const prefs = await getPreferencesByMonth(targetYearMonth);

            // 2. Run Algorithm
            // In a real app we'd fetch actual holidays
            const holidays = [`${targetYearMonth}-29`]; // example dummy holiday
            const generatedShifts = generateShiftsForMonth(targetYearMonth, staffList, prefs, holidays);

            // 3. Save to DB
            await saveShiftsBatch(generatedShifts);

            // 4. Load shifts from DB again just to be safe and update UI
            await loadShifts();
            alert('シフトの自動生成が完了しました！');

        } catch (err) {
            console.error(err);
            alert('シフト生成中にエラーが発生しました。開発モードの場合はコンソールを確認してください。');
        } finally {
            setGenerating(false);
        }
    };

    const eventStyleGetter = (event: any) => {
        let style = {
            backgroundColor: '#4f46e5', // Indigo
            borderRadius: '4px',
            opacity: 0.9,
            color: 'white',
            border: '0px',
            display: 'block'
        };

        if (event.isError) {
            style.backgroundColor = '#ef4444'; // Red for errors
        } else if (event.title.includes('ヘルプ')) {
            style.backgroundColor = '#10b981'; // Emerald for help
        } else if (event.isEarly) {
            style.backgroundColor = '#0284c7'; // Light Blue
        } else {
            style.backgroundColor = '#eab308'; // Yellow
            style.color = '#422006';
        }

        return { style };
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">シフトカレンダー</h2>
                    <p className="text-slate-500 mt-1">{format(nextMonthDate, 'yyyy年M月', { locale: ja })}のシフト状況</p>
                </div>

                <div className="flex space-x-3 w-full sm:w-auto">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className={`flex items-center space-x-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center
                            ${generating ? 'opacity-70 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'}
                        `}
                    >
                        {generating ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <Settings2 className="w-5 h-5 text-indigo-500" />}
                        <span>{generating ? '生成中...' : '自動生成'}</span>
                    </button>
                    <button
                        onClick={() => exportToExcel(targetYearMonth, staffList, rawShifts)}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center"
                    >
                        <Download className="w-5 h-5 text-green-600" />
                        <span>Excel出力</span>
                    </button>
                    <button
                        onClick={() => exportToPDF(targetYearMonth, staffList, rawShifts)}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center"
                    >
                        <Download className="w-5 h-5 text-red-600" />
                        <span>PDF出力</span>
                    </button>
                    <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-1 sm:flex-none justify-center">
                        <Plus className="w-5 h-5" />
                        <span>予定追加</span>
                    </button>
                </div>
            </div>

            {/* Warning Banner */}
            {errorCount > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start space-x-3 flex-shrink-0 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm border-l-2 border-red-500 pl-3">
                        <p className="text-red-900 font-medium mb-1">シフト未割り当てエラーが {errorCount} 件あります。</p>
                        <p className="text-red-700">カレンダー上で赤色ハイライトされている枠をダブルクリックして、手動でスタッフを割り当ててください。</p>
                    </div>
                </div>
            )}

            {/* Calendar Area */}
            <div className="text-xs text-slate-400 mb-1">イベント読み込み数: {events.length}</div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex-1 overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                        <p className="text-slate-500 font-medium">読み込み中...</p>
                    </div>
                )}

                <div className="h-full">
                    <BigCalendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        culture="ja"
                        eventPropGetter={eventStyleGetter}
                        // Default to the month we are generating for
                        defaultDate={nextMonthDate}
                        messages={{
                            next: "次へ",
                            previous: "前へ",
                            today: "今日",
                            month: "月",
                            week: "週",
                            day: "日",
                            agenda: "予定表",
                            date: "日付",
                            time: "時間",
                            event: "イベント",
                            noEventsInRange: "この期間にはシフトがありません。"
                        }}
                        className="font-sans"
                    />
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;
