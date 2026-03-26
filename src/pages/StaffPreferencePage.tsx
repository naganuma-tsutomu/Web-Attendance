import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, LogOut, CheckCircle2, AlertCircle, Loader2, Users, Settings as SettingsIcon, Clock, MapPin, X } from 'lucide-react';
import { getShiftsByMonth, getPreferencesByMonth, updatePreferences, getStaffList, getClasses, getTimePatterns, getRoles } from '../lib/api';
import { handleApiError } from '../lib/errorHandler';
import type { Shift, ShiftClass, ShiftPreferenceDetail, Staff, ShiftTimePattern, DynamicRole } from '../types';
import DailyTimelineView from '../features/schedule/DailyTimelineView';

type TabType = 'preference' | 'shifts' | 'settings';

const StaffPreferencePage = () => {
    const navigate = useNavigate();
    const [staff, setStaff] = useState<{ id: string, name: string } | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('preference');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [allShifts, setAllShifts] = useState<Shift[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [myAvailableDays, setMyAvailableDays] = useState<Staff['availableDays']>(undefined);
    const [classes, setClasses] = useState<ShiftClass[]>([]);
    const [timePatterns, setTimePatterns] = useState<ShiftTimePattern[]>([]);
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [preferences, setPreferences] = useState<ShiftPreferenceDetail[]>([]);
    const [savedPreferences, setSavedPreferences] = useState<ShiftPreferenceDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [selectedDateAction, setSelectedDateAction] = useState<string | null>(null);
    const [selectedStartTime, setSelectedStartTime] = useState<string>('09:00');
    const [selectedEndTime, setSelectedEndTime] = useState<string>('18:00');
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    useEffect(() => {
        const session = localStorage.getItem('staff_session');
        if (!session) {
            navigate('/staff/login');
            return;
        }
        try {
            setStaff(JSON.parse(session));
        } catch {
            localStorage.removeItem('staff_session');
            navigate('/staff/login');
        }
    }, [navigate]);

    useEffect(() => {
        if (!staff) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const monthStr = format(currentMonth, 'yyyy-MM');
                const [shiftsData, prefsData, staffData, classesData, patternsData, rolesData] = await Promise.all([
                    getShiftsByMonth(monthStr),
                    getPreferencesByMonth(monthStr),
                    getStaffList(),
                    getClasses(),
                    getTimePatterns(),
                    getRoles()
                ]);

                setAllShifts(shiftsData);
                setStaffList(staffData);
                setClasses(classesData);
                setTimePatterns(patternsData);
                setRoles(rolesData);
                const myData = staffData.find(s => s.id === staff.id);
                setMyAvailableDays(myData?.availableDays);
                
                const myPref = prefsData.find(p => p.staffId === staff.id);
                const details = myPref?.details || [];
                setPreferences(details);
                setSavedPreferences(details);
            } catch (err) {
                handleApiError(err, 'データの読み込みに失敗しました');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [staff, currentMonth]);

    const handleLogout = async () => {
        localStorage.removeItem('staff_session');
        await fetch('/api/auth/staff-logout', { method: 'POST' }).catch(() => {});
        navigate('/staff/login');
    };

    const handleDateClick = (dateStr: string) => {
        const existing = preferences.find(p => p.date === dateStr);
        if (existing && existing.type === 'training') {
            return; // 研修の日は編集不可
        }
        setSelectedDateAction(dateStr);
        if (existing && existing.startTime && existing.endTime) {
            setSelectedStartTime(existing.startTime);
            setSelectedEndTime(existing.endTime);
        } else {
            setSelectedStartTime('09:00');
            setSelectedEndTime('18:00');
        }
    };

    const applyPreference = (type: 'full' | 'partial' | 'clear') => {
        if (!selectedDateAction) return;
        setPreferences(prev => {
            const filtered = prev.filter(p => p.date !== selectedDateAction);
            if (type === 'clear') return filtered;
            if (type === 'full') {
                return [...filtered, { date: selectedDateAction, startTime: null, endTime: null }];
            }
            return [...filtered, { date: selectedDateAction, startTime: selectedStartTime, endTime: selectedEndTime }];
        });
        setSelectedDateAction(null);
    };

    const handleSave = async () => {
        if (!staff) return;
        setSaving(true);
        setMessage(null);
        try {
            await updatePreferences({
                staffId: staff.id,
                yearMonth: format(currentMonth, 'yyyy-MM'),
                details: preferences
            });
            setSavedPreferences(preferences);
            setMessage({ type: 'success', text: '休暇希望を保存しました' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: '保存に失敗しました' });
        } finally {
            setSaving(false);
        }
    };

    if (!staff) return null;

    const hasChanges = JSON.stringify(
        [...preferences].sort((a, b) => a.date.localeCompare(b.date))
    ) !== JSON.stringify(
        [...savedPreferences].sort((a, b) => a.date.localeCompare(b.date))
    );

    const isFixedHoliday = (date: Date): boolean => {
        if (!myAvailableDays || myAvailableDays.length === 0) return false;
        const dow = getDay(date);
        const nthWeek = Math.ceil(date.getDate() / 7);
        const config = myAvailableDays.find(d => (typeof d === 'number' ? d : d.day) === dow);
        if (!config) return true;
        if (typeof config === 'object' && config.weeks && !config.weeks.includes(nthWeek)) return true;
        return false;
    };

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    });

    const myShifts = allShifts.filter(s => s.staffId === staff.id);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8">
            {/* Top Navigation for Desktop */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 dark:text-white leading-none">
                            {activeTab === 'preference' ? '希望休提出' : activeTab === 'shifts' ? 'シフト確認' : '設定'}
                        </h1>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">{staff.name} さん</p>
                    </div>
                </div>
                
                {/* Desktop Tabs */}
                <nav className="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('preference')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${
                            activeTab === 'preference' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>希望休</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('shifts')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${
                            activeTab === 'shifts' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        <span>シフト確認</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${
                            activeTab === 'settings' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <SettingsIcon className="w-4 h-4" />
                        <span>設定</span>
                    </button>
                </nav>

                <div className="hidden md:block w-10"></div> {/* Spacer to balance header */}
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Month Selector (Constant across tabs except settings) */}
                {activeTab !== 'settings' && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <button
                            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center space-x-2">
                            <span className="text-xl font-black text-slate-800 dark:text-white lowercase tracking-tight">
                                {format(currentMonth, 'yyyy年 M月', { locale: ja })}
                            </span>
                            {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
                        </div>
                        <button
                            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                )}

                {/* Tab Content */}
                {activeTab === 'preference' && (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="font-black text-slate-800 dark:text-white tracking-tight flex items-center space-x-2">
                                    <span>休暇希望</span>
                                    <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase">Tap to Select</span>
                                </h2>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                    {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                        <div key={d} className={`text-center text-[10px] sm:text-xs font-black uppercase tracking-widest pb-2 ${
                                            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
                                        }`}>
                                            {d}
                                        </div>
                                    ))}
                                    {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                                        <div key={`empty-${i}`} />
                                    ))}
                                    {days.map(day => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const pref = preferences.find(p => p.date === dateStr);
                                        const isSelected = !!pref;
                                        const isTraining = pref && pref.type === 'training';
                                        const isPartial = pref && pref.startTime && pref.endTime && !isTraining;
                                        const hasShift = myShifts.some(s => s.date === dateStr);
                                        const isSunday = getDay(day) === 0;
                                        const fixedHoliday = isSunday || isFixedHoliday(day);

                                        return (
                                            <button
                                                key={dateStr}
                                                onClick={() => !fixedHoliday && handleDateClick(dateStr)}
                                                disabled={fixedHoliday}
                                                className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-1 transition-all relative border-2 ${
                                                    fixedHoliday
                                                        ? isSunday
                                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-300 dark:text-red-700 cursor-not-allowed'
                                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                                        : isTraining
                                                            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-600 dark:text-amber-400'
                                                            : isSelected
                                                                ? 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-600 dark:text-red-400'
                                                                : 'bg-white dark:bg-slate-900 border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <span className="text-sm font-black">{format(day, 'd')}</span>
                                                {fixedHoliday && (
                                                    <span className="text-[8px] font-bold mt-0.5">{isSunday ? '休日' : '固定休'}</span>
                                                )}
                                                {!fixedHoliday && hasShift && !isSelected && (
                                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-0.5" />
                                                )}
                                                {!fixedHoliday && isSelected && (
                                                    <span className="text-[8px] font-bold mt-0.5 uppercase">
                                                        {isTraining ? '研修' : isPartial ? '部分休' : '休'}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end gap-3 pt-2">
                                {message && (
                                    <div className={`flex items-center space-x-2 text-sm font-bold animate-in fade-in duration-300 ${
                                        message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                    }`}>
                                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                        <span>{message.text}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    disabled={saving || !hasChanges}
                                    className="w-full md:w-auto px-8 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded-2xl transition-all font-black uppercase tracking-widest flex items-center justify-center"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !hasChanges}
                                    className="w-full md:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all font-black uppercase tracking-widest flex items-center justify-center space-x-2"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>希望を保存</span>}
                                </button>
                            </div>
                        </div>

                        {/* Partial Selection Modal */}
                        {selectedDateAction && (
                            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedDateAction(null)}>
                                <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white">
                                            {format(new Date(selectedDateAction), 'M月d日 (E)', { locale: ja })} の希望
                                        </h3>
                                        <button onClick={() => setSelectedDateAction(null)} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <button
                                            onClick={() => applyPreference('full')}
                                            className="w-full p-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold rounded-2xl transition-colors border border-red-200 dark:border-red-800/50 flex flex-col items-center justify-center"
                                        >
                                            <span className="text-lg mb-1">終日お休み</span>
                                            <span className="text-xs font-medium opacity-80">1日中働くことができません</span>
                                        </button>
                                        
                                        <div className="p-4 bg-indigo-50 hover:bg-indigo-100/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl transition-colors">
                                            <div className="text-center font-bold text-indigo-700 dark:text-indigo-400 mb-3 block">一部の時間だけ不可</div>
                                            <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300 mb-4">
                                                <input
                                                    type="time"
                                                    value={selectedStartTime}
                                                    onChange={e => setSelectedStartTime(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                <span className="font-bold text-slate-400">〜</span>
                                                <input
                                                    type="time"
                                                    value={selectedEndTime}
                                                    onChange={e => setSelectedEndTime(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <button
                                                onClick={() => applyPreference('partial')}
                                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                                            >
                                                この時間帯を不可にする
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => applyPreference('clear')}
                                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                        >
                                            就業可能（クリア）
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cancel Confirmation Modal */}
                        {showCancelConfirm && (
                            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowCancelConfirm(false)}>
                                <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <h3 className="text-lg font-black text-slate-800 dark:text-white">変更を破棄しますか？</h3>
                                        <button onClick={() => setShowCancelConfirm(false)} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-3">
                                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 text-center">保存していない変更はすべて元に戻ります。</p>
                                        <button
                                            onClick={() => { setPreferences(savedPreferences); setShowCancelConfirm(false); }}
                                            className="w-full p-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold rounded-2xl transition-colors border border-red-200 dark:border-red-800/50"
                                        >
                                            破棄する
                                        </button>
                                        <button
                                            onClick={() => setShowCancelConfirm(false)}
                                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                        >
                                            戻る
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {activeTab === 'shifts' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="font-black text-slate-800 dark:text-white tracking-tight">全員のシフト一覧</h2>
                        </div>
                        
                        <div className="flex items-start gap-2 sm:gap-4 relative">
                            {/* Main timeline area */}
                            <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden min-w-0">
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {days.map(day => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const dayShifts = allShifts.filter(s => s.date === dateStr);
                                        
                                        if (dayShifts.length === 0) return null;

                                        return (
                                            <div key={dateStr} id={`shift-date-${dateStr}`} className="flex-shrink-0 flex flex-col space-y-0 border-b border-slate-100 dark:border-slate-800 last:border-0 scroll-mt-24 lg:scroll-mt-28">
                                                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-sm font-bold ${
                                                            day.getDay() === 0 ? 'text-red-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-slate-800 dark:text-white'
                                                        }`}>
                                                            {format(day, 'M/d (E)', { locale: ja })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800">
                                                    <DailyTimelineView
                                                        date={day}
                                                        shifts={dayShifts}
                                                        staffList={staffList}
                                                        classes={classes}
                                                        timePatterns={timePatterns}
                                                        roles={roles}
                                                        readOnly={true}
                                                        hideHeaderToggle={true}
                                                        highlightStaffId={staff.id}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {allShifts.length === 0 && !loading && (
                                        <div className="py-20 text-center">
                                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-slate-400 font-bold">まだシフトが登録されていません</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Date Navigation Sidebar */}
                            <div className="hidden md:flex flex-col sticky top-24 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto hidden-scrollbar">
                                <div className="flex flex-col items-center">
                                    {days.map(d => {
                                        const dateStr = format(d, 'yyyy-MM-dd');
                                        const hasShifts = allShifts.some(s => s.date === dateStr);
                                        if (!hasShifts) return null;
                                        
                                        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                                        const dow = d.getDay();
                                        
                                        return (
                                            <button
                                                key={dateStr}
                                                onClick={() => {
                                                    const el = document.getElementById(`shift-date-${dateStr}`);
                                                    if (el) {
                                                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                                                    }
                                                }}
                                                className={`w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-bold transition-all mb-1 last:mb-0 ${
                                                    isToday 
                                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                                        : dow === 0 ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30' 
                                                        : dow === 6 ? 'text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                                title={format(d, 'M/d (E)', { locale: ja })}
                                            >
                                                {format(d, 'd')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-lg mx-auto">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 p-8 text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                                <Users className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{staff.name}</h2>
                                <p className="text-sm font-bold text-slate-400 mt-1">スタッフアカウント</p>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex flex-col items-center space-y-2">
                                <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-xs font-bold font-mono">ID: {staff.id}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full p-5 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/10 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl group-hover:scale-110 transition-transform">
                                    <LogOut className="w-5 h-5" />
                                </div>
                                <span className="font-black text-slate-700 dark:text-slate-300">ログアウト</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </button>
                    </div>
                )}
            </main>

            {/* Bottom Navigation for Mobile */}
            <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-2xl shadow-2xl z-50 p-2 flex items-center justify-around">
                <button
                    onClick={() => setActiveTab('preference')}
                    className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                        activeTab === 'preference' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400'
                    }`}
                >
                    <Clock className="w-6 h-6" />
                    <span className="text-[10px] sm:text-xs font-bold mt-1 uppercase">希望休</span>
                </button>
                <button
                    onClick={() => setActiveTab('shifts')}
                    className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                        activeTab === 'shifts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400'
                    }`}
                >
                    <Users className="w-6 h-6" />
                    <span className="text-[10px] sm:text-xs font-bold mt-1 uppercase">シフト</span>
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                        activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400'
                    }`}
                >
                    <SettingsIcon className="w-6 h-6" />
                    <span className="text-[10px] sm:text-xs font-bold mt-1 uppercase">設定</span>
                </button>
            </nav>
        </div>
    );
};

export default StaffPreferencePage;
