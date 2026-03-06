import { useState, useEffect, useCallback } from 'react';
import { Calendar, Save, AlertCircle, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { getPreferencesByMonth, savePreference, getStaffList } from '../../lib/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Staff } from '../../types';

interface DayStatus {
    dateStr: string;
    dayOfWeek: string;
    isHoliday: boolean; // 日曜日（休館日）
    status: 'available' | 'unavailable';
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
    '正社員': 'bg-blue-100 text-blue-800',
    '準社員': 'bg-indigo-100 text-indigo-800',
    'パート': 'bg-emerald-100 text-emerald-800',
    '特殊スタッフ': 'bg-amber-100 text-amber-800',
};

const PreferencesPage = () => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [targetDate, setTargetDate] = useState<Date>(addMonths(new Date(), 1));
    const [preferences, setPreferences] = useState<DayStatus[]>([]);
    const [allPrefsForMonth, setAllPrefsForMonth] = useState<Record<string, string[]>>({}); // staffId -> unavailableDates
    const [staffLoading, setStaffLoading] = useState(true);
    const [prefLoading, setPrefLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

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
        try {
            const allPrefs = await getPreferencesByMonth(yearMonth);
            const map: Record<string, string[]> = {};
            allPrefs.forEach(p => {
                map[p.staffId] = p.unavailableDates;
            });
            setAllPrefsForMonth(map);
        } catch (err) {
            console.error(err);
        } finally {
            setPrefLoading(false);
        }
    }, [yearMonth]);

    useEffect(() => {
        fetchAllPrefsForMonth();
    }, [fetchAllPrefsForMonth]);

    // 選択スタッフか月が変わったら、カレンダーを再生成
    useEffect(() => {
        const baseDays = generateMonthDays(targetDate);
        if (selectedStaffId && allPrefsForMonth[selectedStaffId]) {
            const unavailable = allPrefsForMonth[selectedStaffId];
            setPreferences(baseDays.map(day => ({
                ...day,
                status: unavailable.includes(day.dateStr) ? 'unavailable' : 'available',
            })));
        } else {
            setPreferences(baseDays);
        }
    }, [selectedStaffId, targetDate, allPrefsForMonth]);

    const toggleStatus = (index: number) => {
        const newPrefs = [...preferences];
        newPrefs[index].status = newPrefs[index].status === 'available' ? 'unavailable' : 'available';
        setPreferences(newPrefs);
    };

    const handleSave = async () => {
        if (!selectedStaffId) return;
        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            const unavailableDates = preferences
                .filter(p => p.status === 'unavailable')
                .map(p => p.dateStr);

            await savePreference({ staffId: selectedStaffId, yearMonth, unavailableDates });

            // ローカルキャッシュも更新
            setAllPrefsForMonth(prev => ({ ...prev, [selectedStaffId]: unavailableDates }));
            setMessage({ text: '希望休を保存しました！', type: 'success' });
        } catch (err) {
            console.error(err);
            setMessage({ text: '保存に失敗しました。', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const selectedStaff = staffList.find(s => s.id === selectedStaffId);

    const submittedCount = staffList.filter(s => {
        const dates = allPrefsForMonth[s.id];
        return dates !== undefined; // D1にレコードがある = 提出済み
    }).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">希望休管理</h2>
                    <p className="text-slate-500 mt-1">スタッフごとの希望休・出勤不可日を入力・管理します</p>
                </div>
                {/* 月ナビゲーション */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                    <button
                        onClick={() => setTargetDate(d => subMonths(d, 1))}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-slate-800 w-28 text-center">
                        {format(targetDate, 'yyyy年M月', { locale: ja })}
                    </span>
                    <button
                        onClick={() => setTargetDate(d => addMonths(d, 1))}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 提出状況サマリー */}
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">提出状況</p>
                    <p className="text-slate-800 font-semibold mt-0.5">
                        <span className="text-indigo-600 text-lg">{submittedCount}</span>
                        <span className="text-slate-400 text-sm"> / {staffList.length} 名</span>
                        {submittedCount < staffList.length && (
                            <span className="ml-3 text-sm text-amber-600 font-medium">
                                {staffList.length - submittedCount} 名未提出
                            </span>
                        )}
                        {submittedCount === staffList.length && staffList.length > 0 && (
                            <span className="ml-3 text-sm text-emerald-600 font-medium">全員提出済み ✓</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* スタッフ選択サイドバー */}
                <div className="lg:w-56 flex-shrink-0">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">スタッフ選択</p>
                        </div>
                        {staffLoading ? (
                            <div className="p-4 text-center text-slate-400 text-sm">読み込み中...</div>
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
                                                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span className="truncate">{staff.name}</span>
                                                {hasSubmitted
                                                    ? <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="提出済み" />
                                                    : <span className="w-2 h-2 rounded-full bg-slate-200 flex-shrink-0" title="未提出" />
                                                }
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                    {/* 凡例 */}
                    <div className="mt-3 px-3 py-2 text-xs text-slate-500 space-y-1">
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />提出済み</div>
                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />未提出</div>
                    </div>
                </div>

                {/* カレンダーエリア */}
                <div className="flex-1">
                    {!selectedStaffId ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center h-64 text-slate-400">
                            <div className="text-center">
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>スタッフを選択してください</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {/* カレンダーヘッダー */}
                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-slate-800">
                                            {selectedStaff?.name}
                                        </span>
                                        {selectedStaff && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[selectedStaff.role] || ''}`}>
                                                {selectedStaff.role}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {format(targetDate, 'yyyy年M月', { locale: ja })} の希望休
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
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
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                                    }`}>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {message.text}
                                </div>
                            )}

                            {/* 日付グリッド */}
                            <div className="p-5">
                                {prefLoading ? (
                                    <div className="text-center py-12 text-slate-400">読み込み中...</div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                                        {preferences
                                            .filter(item => !item.isHoliday)
                                            .map((item) => {
                                                const realIndex = preferences.indexOf(item);
                                                const isSaturday = item.dayOfWeek === '土';
                                                return (
                                                    <button
                                                        key={item.dateStr}
                                                        onClick={() => toggleStatus(realIndex)}
                                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer select-none
                                                            ${item.status === 'unavailable'
                                                                ? 'bg-red-50 border-red-300 shadow-sm'
                                                                : isSaturday
                                                                    ? 'bg-blue-50 border-blue-100 hover:border-blue-300'
                                                                    : 'bg-white border-slate-200 hover:border-indigo-200'
                                                            }`}
                                                    >
                                                        <span className={`text-xs font-semibold mb-1 ${isSaturday ? 'text-blue-600' : 'text-slate-500'}`}>
                                                            {item.dayOfWeek}
                                                        </span>
                                                        <span className={`text-base font-bold ${item.status === 'unavailable' ? 'text-red-700' : isSaturday ? 'text-blue-800' : 'text-slate-800'}`}>
                                                            {parseInt(item.dateStr.split('-')[2])}
                                                        </span>
                                                        <span className={`text-xs font-bold mt-1.5 px-1.5 py-0.5 rounded-md ${item.status === 'unavailable'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                            {item.status === 'unavailable' ? '×不可' : '○可'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* 保存フッター */}
                            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                <p className="text-sm text-slate-500">
                                    不可: <span className="font-semibold text-red-600">
                                        {preferences.filter(p => p.status === 'unavailable').length} 日
                                    </span>
                                </p>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || prefLoading}
                                    className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors font-medium text-sm ${(saving || prefLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
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
