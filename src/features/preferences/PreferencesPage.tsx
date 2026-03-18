import { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, AlertCircle, ChevronLeft, ChevronRight, Users, Loader2, RefreshCw, X, Edit2, CheckCircle2, Clock, CalendarX } from 'lucide-react';
import { getPreferencesByMonth, savePreference, getStaffList, syncHolidays } from '../../lib/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { saveActiveMonth, loadActiveMonth } from '../../utils/dateUtils';
import type { Staff } from '../../types';

interface DayStatus {
    dateStr: string;
    dayOfWeek: string;
    isHoliday: boolean; // 日曜日（休館日）
    status: 'available' | 'unavailable' | 'fixed';
    startTime?: string | null;
    endTime?: string | null;
}

const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

const generateMonthDays = (baseDate: Date): DayStatus[] => {
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    return eachDayOfInterval({ start, end }).map(date => {
        const dayOfWeekIndex = getDay(date);
        return {
            dateStr: format(date, 'yyyy-MM-dd'),
            dayOfWeek: dayNames[dayOfWeekIndex],
            isHoliday: dayOfWeekIndex === 0, // 日曜日は休館日
            status: 'available',
        };
    });
};

const ROLE_COLORS: Record<string, string> = {
    '正社員': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    '準社員': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    'パート': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    '特殊スタッフ': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const PreferencesPage = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [targetDate, setTargetDate] = useState<Date>(() => loadActiveMonth());
    const [preferences, setPreferences] = useState<DayStatus[]>([]);
    const [allPrefsForMonth, setAllPrefsForMonth] = useState<Record<string, { date: string, startTime: string | null, endTime: string | null }[]>>({}); // staffId -> details
    const [staffLoading, setStaffLoading] = useState(true);
    const [prefLoading, setPrefLoading] = useState(false);
    const [prefError, setPrefError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [syncingHolidays, setSyncingHolidays] = useState(false);
    const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
    const [isEditingModalMode, setIsEditingModalMode] = useState(false);
    const [editStartTime, setEditStartTime] = useState<string>('09:00');
    const [editEndTime, setEditEndTime] = useState<string>('18:00');

    const yearMonth = format(targetDate, 'yyyy-MM');

    // スタッフ一覧を取得
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const data = await getStaffList();
                setStaffList(data);
                if (data.length > 0 && !selectedStaffId) {
                    setSelectedStaffId(data[0].id);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setStaffLoading(false);
            }
        };
        fetchStaff();
    }, []);

    // 月が変わったら、その月の全スタッフの希望休をまとめて取得
    const fetchAllPrefsForMonth = useCallback(async () => {
        setPrefLoading(true);
        setPrefError(null);
        try {
            const allPrefs = await getPreferencesByMonth(yearMonth);
            const map: Record<string, { date: string, startTime: string | null, endTime: string | null }[]> = {};
            allPrefs.forEach(p => {
                map[p.staffId] = p.details || [];
            });
            setAllPrefsForMonth(map);
        } catch (err) {
            console.error(err);
            setPrefError('希望休データの読み込みに失敗しました。');
        } finally {
            setPrefLoading(false);
        }
    }, [yearMonth]);

    const handleRetryPrefs = () => {
        fetchAllPrefsForMonth();
    };

    useEffect(() => {
        fetchAllPrefsForMonth();
    }, [fetchAllPrefsForMonth]);

    // 月が変更されたら localStorage に保存
    useEffect(() => {
        saveActiveMonth(targetDate);
    }, [targetDate]);

    // 選択スタッフか月が変わったら、カレンダーを再生成
    useEffect(() => {
        const baseDays = generateMonthDays(targetDate);
        if (selectedStaffId) {
            const staff = staffList.find(s => s.id === selectedStaffId);
            const unavailable = allPrefsForMonth[selectedStaffId] || [];

            setPreferences(baseDays.map(day => {
                // 固定休日判定
                const dayOfWeek = getDay(new Date(day.dateStr));
                const config = staff?.availableDays?.find(ad =>
                    (typeof ad === 'number' ? ad : ad.day) === dayOfWeek
                );

                // 固定休日（availableDays に含まれない、または特定週のみ）の判定
                let isFixedHoliday = false;
                if (!config && dayOfWeek !== 0) { // 日曜以外で config がない = 毎週休み
                    isFixedHoliday = true;
                } else if (typeof config === 'object' && config.weeks) {
                    // 何週目か取得
                    const dateObj = new Date(day.dateStr);
                    const weekNum = Math.ceil(dateObj.getDate() / 7);
                    if (!config.weeks.includes(weekNum)) {
                        isFixedHoliday = true;
                    }
                }

                if (isFixedHoliday) return { ...day, status: 'fixed' };

                const pref = unavailable.find(u => u.date === day.dateStr);

                return {
                    ...day,
                    status: pref ? 'unavailable' : 'available',
                    startTime: pref?.startTime,
                    endTime: pref?.endTime
                };
            }));
        } else {
            setPreferences(baseDays);
        }
    }, [selectedStaffId, targetDate, allPrefsForMonth, staffList]);

    const handleDateClick = (index: number) => {
        const item = preferences[index];
        if (item.status === 'fixed' || item.isHoliday) return;
        setIsEditingModalMode(false);
        setEditingDateIndex(index);
        if (item.startTime && item.endTime) {
            setEditStartTime(item.startTime);
            setEditEndTime(item.endTime);
        } else {
            setEditStartTime('09:00');
            setEditEndTime('18:00');
        }
    };

    const applyDatePreference = (type: 'full' | 'partial' | 'clear') => {
        if (editingDateIndex === null) return;
        const newPrefs = [...preferences];
        if (type === 'clear') {
            newPrefs[editingDateIndex].status = 'available';
            newPrefs[editingDateIndex].startTime = null;
            newPrefs[editingDateIndex].endTime = null;
        } else if (type === 'full') {
            newPrefs[editingDateIndex].status = 'unavailable';
            newPrefs[editingDateIndex].startTime = null;
            newPrefs[editingDateIndex].endTime = null;
        } else {
            newPrefs[editingDateIndex].status = 'unavailable';
            newPrefs[editingDateIndex].startTime = editStartTime;
            newPrefs[editingDateIndex].endTime = editEndTime;
        }
        setPreferences(newPrefs);
        setEditingDateIndex(null);
    };

    const handleSave = async () => {
        if (!selectedStaffId) return;
        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            const details = preferences
                .filter(p => p.status === 'unavailable')
                .map(p => ({ date: p.dateStr, startTime: p.startTime || null, endTime: p.endTime || null }));
            const unavailableDates = details.filter(d => !d.startTime).map(d => d.date);

            await savePreference({ staffId: selectedStaffId, yearMonth, unavailableDates, details });

            // ローカルキャッシュも更新
            setAllPrefsForMonth(prev => ({ ...prev, [selectedStaffId]: details }));
            setMessage({ text: '休日設定を保存しました！', type: 'success' });
        } catch (err) {
            console.error(err);
            setMessage({ text: '保存に失敗しました。', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const handleSyncHolidays = async () => {
        setSyncingHolidays(true);
        try {
            const res = await syncHolidays();
            if (res.success) {
                setMessage({ text: `祝日を同期しました（${res.synced}件追加）`, type: 'success' });
            }
        } catch (err) {
            console.error(err);
            setMessage({ text: '祝日の同期に失敗しました。', type: 'error' });
        } finally {
            setSyncingHolidays(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const selectedStaff = staffList.find(s => s.id === selectedStaffId);

    const submittedCount = staffList.filter(s => {
        const dates = allPrefsForMonth[s.id];
        return dates !== undefined; // D1にレコードがある = 提出済み
    }).length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto w-full p-4 sm:p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">休日管理</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">スタッフごとの休日・出勤不可日を入力・管理します</p>
                </div>
                {/* 月ナビゲーション */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                    <button
                        onClick={() => setTargetDate(d => subMonths(d, 1))}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 w-28 text-center">
                        {format(targetDate, 'yyyy年M月', { locale: ja })}
                    </span>
                    <button
                        onClick={() => setTargetDate(d => addMonths(d, 1))}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
                {/* 祝日同期ボタン */}
                <button
                    onClick={handleSyncHolidays}
                    disabled={syncingHolidays}
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
                    title="今年と来年の祝日データを最新に更新します"
                >
                    <RefreshCw className={`w-4 h-4 text-indigo-500 ${syncingHolidays ? 'animate-spin' : ''}`} />
                    <span>{syncingHolidays ? '同期中...' : '祝日を同期'}</span>
                </button>
            </div>

            {/* 提出状況サマリー */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">提出状況</p>
                    <p className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
                        <span className="text-indigo-600 dark:text-indigo-400 text-lg">{submittedCount}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-sm"> / {staffList.length} 名</span>
                        {submittedCount < staffList.length && (
                            <span className="ml-3 text-sm text-amber-600 dark:text-amber-400 font-medium">
                                {staffList.length - submittedCount} 名未提出
                            </span>
                        )}
                        {submittedCount === staffList.length && staffList.length > 0 && (
                            <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">全員提出済み ✓</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* スタッフ選択サイドバー */}
                <div className="lg:w-56 flex-shrink-0">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">スタッフ選択</p>
                        </div>
                        {staffLoading ? (
                            <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-sm">読み込み中...</div>
                        ) : (
                            <ul className="p-2 space-y-1">
                                {staffList.map(staff => {
                                    const isSelected = staff.id === selectedStaffId;
                                    const hasSubmitted = allPrefsForMonth[staff.id] !== undefined;
                                    return (
                                        <li key={staff.id}>
                                            <button
                                                onClick={() => setSelectedStaffId(staff.id)}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-sm font-medium flex items-center justify-between gap-2 ${isSelected
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                <span className="truncate">{staff.name}</span>
                                                {hasSubmitted
                                                    ? <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="提出済み" />
                                                    : <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" title="未提出" />
                                                }
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                    {/* 凡例 */}
                    <div className="mt-3 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />提出済み</div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 inline-block" />未提出</div>
                    </div>
                </div>

                {/* カレンダーエリア */}
                <div className="flex-1">
                    {!selectedStaffId ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">
                            <div className="text-center">
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>スタッフを選択してください</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                            {/* カレンダーヘッダー */}
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-slate-800 dark:text-white">
                                            {selectedStaff?.name}
                                        </span>
                                        {selectedStaff && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[selectedStaff.role] || ''}`}>
                                                {selectedStaff.role}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                        {format(targetDate, 'yyyy年M月', { locale: ja })} の休日設定
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 inline-block" />固定休
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />可能
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />不可
                                    </span>
                                </div>
                            </div>

                            {/* メッセージ */}
                            {message.text && (
                                <div className={`mx-5 mt-4 p-3 rounded-xl flex items-center gap-2 text-sm font-medium border ${message.type === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                                    }`}>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {message.text}
                                </div>
                            )}

                            {/* エラー表示 */}
                            {prefError && (
                                <div className="mx-5 mt-4 p-3 rounded-xl flex items-center justify-between gap-2 text-sm font-medium border bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" role="alert">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        {prefError}
                                    </div>
                                    <button
                                        onClick={handleRetryPrefs}
                                        disabled={prefLoading}
                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                                        aria-label="再試行"
                                    >
                                        {prefLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        再試行
                                    </button>
                                </div>
                            )}

                            {/* 曜日ヘッダー */}
                            <div className="px-5 pt-4">
                                <div className="grid grid-cols-6 gap-2.5 mb-2">
                                    {['月', '火', '水', '木', '金', '土'].map((d) => (
                                        <div key={d} className={`text-center text-xs font-bold py-1 ${d === '土' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {d}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 日付グリッド */}
                            <div className="p-5 pt-0">
                                {prefLoading ? (
                                    <div className="text-center py-12 text-slate-400">読み込み中...</div>
                                ) : (
                                    <div className="grid grid-cols-6 gap-2.5">
                                        {/* 月の開始曜日（1日）に合わせた空セルを挿入（オフセット） */}
                                        {(() => {
                                            const firstDay = preferences[0];
                                            if (!firstDay) return null;
                                            const firstDayObj = new Date(firstDay.dateStr);
                                            const dayOfWeek = firstDayObj.getDay(); // 0: 日, 1: 月, ..., 6: 土

                                            // 1日が日曜日の場合は非表示なので、次の月曜日(2日)から始まる。その場合はオフセット0。
                                            // それ以外は dayOfWeek - 1 個の空セルが必要
                                            const offset = dayOfWeek === 0 ? 0 : dayOfWeek - 1;
                                            return Array.from({ length: offset }).map((_, i) => (
                                                <div key={`empty-${i}`} className="p-3" />
                                            ));
                                        })()}

                                        {preferences
                                            .filter(item => !item.isHoliday)
                                            .map((item) => {
                                                const realIndex = preferences.indexOf(item);
                                                const isSaturday = item.dayOfWeek === '土';
                                                return (
                                                    <button
                                                        key={item.dateStr}
                                                        onClick={() => handleDateClick(realIndex)}
                                                        disabled={item.status === 'fixed'}
                                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-150 select-none
                                                            ${item.status === 'fixed'
                                                                ? 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed'
                                                                : item.status === 'unavailable'
                                                                    ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800 shadow-sm'
                                                                    : isSaturday
                                                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                                                            }`}
                                                    >
                                                        <span className={`text-base font-bold ${item.status === 'fixed' ? 'text-slate-400 dark:text-slate-500' : item.status === 'unavailable' ? 'text-red-700 dark:text-red-400' : isSaturday ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                                            {parseInt(item.dateStr.split('-')[2])}
                                                        </span>
                                                        <span className={`text-[10px] font-bold mt-1 px-1 py-0.5 rounded-md ${item.status === 'fixed'
                                                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                            : item.status === 'unavailable'
                                                                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                                                : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                                            }`}>
                                                            {item.status === 'fixed' ? '固定休' : item.status === 'unavailable' ? (item.startTime ? `${item.startTime}~不可` : '不可') : '○'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* 日付編集モーダル */}
                            {editingDateIndex !== null && preferences[editingDateIndex] && (
                                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setEditingDateIndex(null)}>
                                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white">
                                                {format(new Date(preferences[editingDateIndex].dateStr), 'M月d日 (E)', { locale: ja })}
                                                <span className="text-sm font-medium text-slate-400 ml-2">{selectedStaff?.name}</span>
                                            </h3>
                                            <button onClick={() => setEditingDateIndex(null)} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* 現在の状態表示 (編集前) */}
                                        {!isEditingModalMode ? (() => {
                                            const status = preferences[editingDateIndex].status;
                                            const isPartial = status === 'unavailable' && preferences[editingDateIndex].startTime;
                                            
                                            return (
                                                <div className="px-6 py-10 flex flex-col items-center">
                                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-6 uppercase">Current Status</div>
                                                    
                                                    {status === 'available' && (
                                                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                                                            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_2rem_-0.5rem_#10b981] dark:shadow-none ring-4 ring-emerald-50 dark:ring-emerald-900/10">
                                                                <CheckCircle2 className="w-10 h-10" />
                                                            </div>
                                                            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-wide">就業可能</div>
                                                            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-2">シフトに入ることができます</p>
                                                        </div>
                                                    )}

                                                    {status === 'unavailable' && !isPartial && (
                                                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                                                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_2rem_-0.5rem_#ef4444] dark:shadow-none ring-4 ring-red-50 dark:ring-red-900/10">
                                                                <CalendarX className="w-10 h-10" />
                                                            </div>
                                                            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-wide">終日不可</div>
                                                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-2">1日を通してシフトに入れません</p>
                                                        </div>
                                                    )}

                                                    {isPartial && (
                                                        <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
                                                            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_2rem_-0.5rem_#ef4444] dark:shadow-none ring-4 ring-red-50 dark:ring-red-900/10">
                                                                <Clock className="w-10 h-10" />
                                                            </div>
                                                            <div className="text-2xl font-black text-slate-800 dark:text-white tracking-wide mb-2">一部不可</div>
                                                            <div className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-4 py-2 rounded-2xl font-bold flex items-center gap-2">
                                                                <span className="font-mono text-lg">{preferences[editingDateIndex].startTime}</span>
                                                                <span className="text-red-400">〜</span>
                                                                <span className="font-mono text-lg">{preferences[editingDateIndex].endTime}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="w-full mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                                                        <button
                                                            onClick={() => setIsEditingModalMode(true)}
                                                            className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all border border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                            <span>設定を変更する</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            /* 編集モード */
                                            <div className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                                <button
                                                    onClick={() => applyDatePreference('full')}
                                                    className="w-full p-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-bold rounded-2xl transition-colors border border-red-200 dark:border-red-800/50 flex flex-col items-center justify-center"
                                                >
                                                    <span className="text-lg mb-1">終日不可</span>
                                                    <span className="text-xs font-medium opacity-80">1日中シフトに入れない</span>
                                                </button>

                                                <div className="p-4 bg-indigo-50 hover:bg-indigo-100/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl transition-colors">
                                                    <div className="text-center font-bold text-indigo-700 dark:text-indigo-400 mb-3 block">一部の時間だけ不可</div>
                                                    <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300 mb-4">
                                                        <input
                                                            type="time"
                                                            value={editStartTime}
                                                            onChange={e => setEditStartTime(e.target.value)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                        <span className="font-bold text-slate-400">〜</span>
                                                        <input
                                                            type="time"
                                                            value={editEndTime}
                                                            onChange={e => setEditEndTime(e.target.value)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => applyDatePreference('partial')}
                                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                                                    >
                                                        この時間帯を不可にする
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => applyDatePreference('clear')}
                                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                                                >
                                                    就業可能（クリア）
                                                </button>
                                                
                                                <button
                                                    onClick={() => setIsEditingModalMode(false)}
                                                    className="w-full py-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-semibold mt-2"
                                                >
                                                    キャンセル
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 保存フッター */}
                            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    不可: <span className="font-semibold text-red-600 dark:text-red-400">
                                        {preferences.filter(p => p.status === 'unavailable').length} 日
                                    </span>
                                </p>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || prefLoading}
                                    className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors font-medium text-sm ${(saving || prefLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? '保存中...' : '保存する'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PreferencesPage;
