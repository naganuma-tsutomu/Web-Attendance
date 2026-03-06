import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Settings2, Download, Plus, AlertCircle, Loader2, Save, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getStaffList, getPreferencesByMonth, getShiftsByMonth, saveShiftsBatch, getRoleSettings, updateShift } from '../../lib/api';
import { generateShiftsForMonth } from '../../lib/algorithm';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';
import type { Shift, Staff } from '../../types';
import DailyTimelineModal from './DailyTimelineModal';

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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [editFormData, setEditFormData] = useState({
        staffId: '',
        startTime: '',
        endTime: ''
    });

    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
    const [selectedDateForTimeline, setSelectedDateForTimeline] = useState<Date | null>(null);

    const [currentMonth, setCurrentMonth] = useState(addMonths(new Date(), 1));
    const targetYearMonth = format(currentMonth, 'yyyy-MM');

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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadShifts();
    }, [targetYearMonth]);

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
        if (!window.confirm(`${format(currentMonth, 'yyyy年M月')}のシフトを自動生成します。よろしいですか？`)) return;

        setGenerating(true);
        try {
            const staffs = await getStaffList();
            const prefs = await getPreferencesByMonth(targetYearMonth);
            const roleSettings = await getRoleSettings();

            // example dummy holiday
            const holidays: string[] = [];
            const generatedShifts = generateShiftsForMonth(targetYearMonth, staffs, prefs, roleSettings, holidays);

            await saveShiftsBatch(generatedShifts);
            await loadShifts();
            alert('シフトの自動生成が完了しました！');
        } catch (err) {
            console.error(err);
            alert('シフト生成中にエラーが発生しました。');
        } finally {
            setGenerating(false);
        }
    };

    const handleEventSelect = (event: any) => {
        setSelectedEvent(event);
        const shift = rawShifts.find(s => s.id === event.id);
        if (shift) {
            setEditFormData({
                staffId: shift.staffId === 'UNASSIGNED' ? '' : shift.staffId,
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
                // Update existing
                await updateShift(selectedEvent.id, {
                    staffId: editFormData.staffId || 'UNASSIGNED',
                    startTime: editFormData.startTime,
                    endTime: editFormData.endTime,
                    isError: editFormData.staffId === ''
                });
            } else {
                // Add new (Simple manual add for today displayed in calendar)
                const dateStr = format(currentMonth, 'yyyy-MM-01'); // Just as a placeholder date in that month
                await saveShiftsBatch([{
                    date: dateStr,
                    staffId: editFormData.staffId || 'UNASSIGNED',
                    startTime: editFormData.startTime,
                    endTime: editFormData.endTime,
                    classType: '虹組',
                    isEarlyShift: false,
                    isError: editFormData.staffId === ''
                }]);
            }
            setIsEditModalOpen(false);
            loadShifts();
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
        let style = {
            backgroundColor: '#4f46e5',
            borderRadius: '4px',
            opacity: 0.9,
            color: 'white',
            border: '0px',
            display: 'block'
        };

        if (event.isError) {
            style.backgroundColor = '#ef4444';
        } else if (event.title.includes('ヘルプ')) {
            style.backgroundColor = '#10b981';
        } else if (event.isEarly) {
            style.backgroundColor = '#0284c7';
        } else {
            style.backgroundColor = '#eab308';
            style.color = '#422006';
        }

        return { style };
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 flex-shrink-0">
                <div className="flex items-center space-x-4">
                    <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div className="px-3 py-1.5 font-bold text-slate-800">
                            {format(currentMonth, 'yyyy年M月', { locale: ja })}
                        </div>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>
                </div>

                <div className="flex space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className={`flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0
                            ${generating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700'}
                        `}
                    >
                        {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings2 className="w-5 h-5" />}
                        <span className="whitespace-nowrap">{generating ? '生成中...' : '自動生成'}</span>
                    </button>
                    <button
                        onClick={async () => {
                            if (!window.confirm('この月のシフトをすべて削除してよろしいですか？')) return;
                            await fetch(`/api/shifts?yearMonth=${targetYearMonth}`, { method: 'DELETE', credentials: 'include' });
                            loadShifts();
                        }}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-red-50 text-slate-700 hover:text-red-600 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0"
                    >
                        <Trash2 className="w-5 h-5 text-red-500" />
                        <span className="whitespace-nowrap text-xs sm:text-sm">消去</span>
                    </button>
                    <button
                        onClick={() => exportToExcel(targetYearMonth, staffList, rawShifts)}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0"
                    >
                        <Download className="w-5 h-5 text-green-600" />
                        <span className="whitespace-nowrap text-xs sm:text-sm">Excel</span>
                    </button>
                    <button
                        onClick={() => exportToPDF(targetYearMonth, staffList, rawShifts)}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0"
                    >
                        <Download className="w-5 h-5 text-red-600" />
                        <span className="whitespace-nowrap text-xs sm:text-sm">PDF</span>
                    </button>
                    <button
                        onClick={() => {
                            setSelectedEvent(null);
                            setEditFormData({
                                staffId: '',
                                startTime: '09:00',
                                endTime: '18:00'
                            });
                            setIsEditModalOpen(true);
                        }}
                        className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="whitespace-nowrap text-xs sm:text-sm">追加</span>
                    </button>
                </div>
            </div>

            {/* Warning Banner */}
            {errorCount > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start space-x-3 flex-shrink-0 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm border-l-2 border-red-500 pl-3">
                        <p className="text-red-900 font-medium">シフトエラーがあります ({errorCount}件)</p>
                    </div>
                </div>
            )}

            {/* Calendar Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex-1 overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
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
                        onSelectEvent={handleEventSelect}
                        selectable={true}
                        onSelectSlot={(slotInfo) => {
                            if (slotInfo.action === 'click' || slotInfo.action === 'doubleClick') {
                                handleOpenTimeline(slotInfo.start);
                            }
                        }}
                        onDrillDown={(date) => handleOpenTimeline(date)}
                        views={['month']}
                        date={currentMonth}
                        onNavigate={(newDate) => setCurrentMonth(newDate)}
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

            {/* Shift Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800">
                                {selectedEvent ? 'シフトの修正' : '予定の新規追加'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateShift} className="p-6 space-y-4">
                            {!selectedEvent && (
                                <p className="text-xs text-slate-500 italic">※新規追加は暫定的に月初のデータとして登録されます。</p>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">担当スタッフ</label>
                                <select
                                    value={editFormData.staffId}
                                    onChange={e => setEditFormData({ ...editFormData, staffId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                >
                                    <option value="">未割り当て</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">開始時間</label>
                                    <input
                                        type="time"
                                        required
                                        value={editFormData.startTime}
                                        onChange={e => setEditFormData({ ...editFormData, startTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">終了時間</label>
                                    <input
                                        type="time"
                                        required
                                        value={editFormData.endTime}
                                        onChange={e => setEditFormData({ ...editFormData, endTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
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
                    onClose={() => setIsTimelineModalOpen(false)}
                />
            )}
        </div>
    );
};

export default SchedulePage;
