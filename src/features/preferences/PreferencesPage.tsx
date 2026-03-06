import { useState, useEffect } from 'react';
import { Calendar, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getPreferencesByMonth, savePreference } from '../../lib/api';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DayStatus {
    dateStr: string; // 'YYYY-MM-DD'
    dayOfWeek: string; // '月', '火', etc.
    isWeekendOrHoliday: boolean;
    status: 'available' | 'unavailable';
}

const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

const generateNextMonthDays = (): DayStatus[] => {
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    const start = startOfMonth(nextMonth);
    const end = endOfMonth(nextMonth);

    const days = eachDayOfInterval({ start, end });

    return days.map(date => {
        const dayOfWeekIndex = getDay(date);
        return {
            dateStr: format(date, 'yyyy-MM-dd'),
            dayOfWeek: dayNames[dayOfWeekIndex],
            isWeekendOrHoliday: dayOfWeekIndex === 0, // 日曜日はデフォで休館日扱い（祝日判定は一旦省略）
            status: 'available' // デフォルトは可能
        };
    });
};

const PreferencesPage = () => {
    const { currentUser } = useAuth();
    const [preferences, setPreferences] = useState<DayStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const nextMonthDate = addMonths(new Date(), 1);
    const targetYearMonth = format(nextMonthDate, 'yyyy-MM');

    useEffect(() => {
        const fetchExistingPrefs = async () => {
            if (!currentUser) return;

            try {
                // Generate base calendar
                const baseDays = generateNextMonthDays();

                // Check if user already submitted for this month
                const allPrefs = await getPreferencesByMonth(targetYearMonth);
                const userPref = allPrefs.find(p => p.staffId === currentUser.uid);

                if (userPref && userPref.unavailableDates.length > 0) {
                    // Make unavailable dates reflect in state
                    const updatedDays = baseDays.map(day => ({
                        ...day,
                        status: userPref.unavailableDates.includes(day.dateStr) ? 'unavailable' as const : 'available' as const
                    }));
                    setPreferences(updatedDays);
                } else {
                    setPreferences(baseDays);
                }
            } catch (err) {
                console.error("Fetch error", err);
                // Fallback to empty base calendar
                setPreferences(generateNextMonthDays());
                setMessage({ text: 'データの取得に失敗しました。', type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchExistingPrefs();
    }, [currentUser, targetYearMonth]);

    const toggleStatus = (index: number) => {
        const newPrefs = [...preferences];
        newPrefs[index].status = newPrefs[index].status === 'available' ? 'unavailable' : 'available';
        setPreferences(newPrefs);
    };

    const handleSave = async () => {
        if (!currentUser) return;
        setSaving(true);
        setMessage({ text: '', type: '' });

        try {
            const unavailableDates = preferences
                .filter(p => p.status === 'unavailable')
                .map(p => p.dateStr);

            await savePreference({
                staffId: currentUser.uid,
                yearMonth: targetYearMonth,
                unavailableDates,
            });

            setMessage({ text: '希望休を保存しました！', type: 'success' });
        } catch (err) {
            console.error(err);
            setMessage({ text: '保存に失敗しました。時間をおいて再度お試しください。', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Area */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">希望休・出勤不可日入力</h2>
                <p className="text-slate-500 mt-1">翌月のシフト作成に向けた希望休を入力してください。</p>
            </div>

            {message.text && (
                <div className={`border rounded-xl p-4 flex items-start space-x-3 
                    ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}
                `}>
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-indigo-900 leading-relaxed">
                    <p className="font-medium mb-1">【提出期限】毎月20日まで</p>
                    <p>出勤できない日（希望休・予定あり等）を「不可」に変更して保存してください。</p>
                </div>
            </div>

            {/* Calendar/List Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center space-x-2 text-slate-800 font-semibold text-lg">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <span>{format(nextMonthDate, 'yyyy年M月', { locale: ja })}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-sm">
                        <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-400 mr-2"></span>可能</span>
                        <span className="flex items-center ml-4"><span className="w-3 h-3 rounded-full bg-red-400 mr-2"></span>不可</span>
                    </div>
                </div>

                <div className="p-4 sm:p-6">
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">カレンダーを読み込んでいます...</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                            {preferences.map((item, index) => (
                                <button
                                    key={item.dateStr}
                                    onClick={() => toggleStatus(index)}
                                    disabled={item.isWeekendOrHoliday}
                                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-200
                      ${item.isWeekendOrHoliday ? 'bg-slate-50/50 text-slate-400 border-slate-100 cursor-not-allowed hidden' : ''}
                      ${item.dayOfWeek === '土' ? 'bg-blue-50/50 text-blue-900 border-blue-100 hover:border-blue-300' : ''}
                      ${!item.isWeekendOrHoliday && item.dayOfWeek !== '土' ? 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm' : ''}
                    `}
                                    style={{ display: item.isWeekendOrHoliday ? 'none' : 'flex' }}
                                >
                                    <span className="text-sm font-medium mb-1 text-slate-700">
                                        {parseInt(item.dateStr.split('-')[2])}日 ({item.dayOfWeek})
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold mt-2 shadow-sm
                      ${item.status === 'available' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100 text-red-700 ring-2 ring-red-300'}
                    `}>
                                        {item.status === 'available' ? '○ 可能' : '× 不可'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className={`flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl shadow-sm transition-colors font-medium
                            ${(saving || loading) ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
                    >
                        <Save className="w-5 h-5" />
                        <span>{saving ? '保存中...' : '希望休を提出する'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreferencesPage;
