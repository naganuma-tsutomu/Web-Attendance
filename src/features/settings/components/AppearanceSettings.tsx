import { Moon, Sun, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useBusinessHours, useUpdateBusinessHours } from '../../../lib/hooks';
import { getWeekStartsOn, setWeekStartsOn as saveWeekStartsOn, STORAGE_KEYS } from '../../../utils/dateUtils';

const AppearanceSettings = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
    });
    const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => getWeekStartsOn());

    // 営業時間設定
    const { data: businessHours, isLoading: isLoadingHours } = useBusinessHours();
    const updateBusinessHoursMutation = useUpdateBusinessHours();
    const [startHour, setStartHour] = useState(8);
    const [endHour, setEndHour] = useState(19);
    const [closedDays, setClosedDays] = useState<number[]>([]);
    const [hoursModified, setHoursModified] = useState(false);

    useEffect(() => {
        if (businessHours) {
            setStartHour(businessHours.startHour);
            setEndHour(businessHours.endHour);
            setClosedDays(businessHours.closedDays || []);
            setHoursModified(false);
        }
    }, [businessHours]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
    }, [theme]);

    useEffect(() => {
        saveWeekStartsOn(weekStartsOn);
    }, [weekStartsOn]);

    const handleStartHourChange = (value: number) => {
        setStartHour(value);
        setHoursModified(true);
    };

    const handleEndHourChange = (value: number) => {
        setEndHour(value);
        setHoursModified(true);
    };

    const toggleClosedDay = (day: number) => {
        setClosedDays(prev => 
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
        );
        setHoursModified(true);
    };

    const handleSaveBusinessHours = async () => {
        if (startHour >= endHour) {
            toast.error('開始時間は終了時間より前に設定してください');
            return;
        }
        if (endHour - startHour < 2) {
            toast.error('営業時間は最低2時間必要です');
            return;
        }
        try {
            await updateBusinessHoursMutation.mutateAsync({ startHour, endHour, closedDays });
            toast.success('営業時間・休館日を保存しました');
            setHoursModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    const hourOptions = Array.from({ length: 25 }, (_, i) => i); // 0-24
    const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土', '祝日'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="space-y-8">
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">カラーテーマ</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">アプリ全体の配色を切り替えます。</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start sm:self-auto">
                            <button
                                onClick={() => setTheme('light')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Sun className="w-4 h-4" />
                                <span className="sm:inline">ライト</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'dark' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Moon className="w-4 h-4" />
                                <span className="sm:inline">ダーク</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">週の開始日</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">カレンダーの表示を開始する曜日を選択します。</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start sm:self-auto">
                            <button
                                onClick={() => setWeekStartsOn(0)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 0 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                日曜日
                            </button>
                            <button
                                onClick={() => setWeekStartsOn(1)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 1 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                月曜日
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                            ※ 現時点ではダークモードは一部の画面で正しく表示されない場合があります。順次対応中です。
                        </p>
                    </div>
                </div>
            </div>

            {/* 営業時間設定 */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="w-5 h-5 text-indigo-500" />
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">営業時間</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                タイムラインの表示範囲とExcel出力の時間範囲を設定します。
                            </p>
                        </div>
                    </div>

                    {isLoadingHours ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-slate-400 text-sm animate-pulse">読み込み中...</div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[60px]">
                                        開始時間
                                    </label>
                                    <select
                                        value={startHour}
                                        onChange={(e) => handleStartHourChange(parseInt(e.target.value))}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    >
                                        {hourOptions.filter(h => h < 24).map(h => (
                                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-slate-400 hidden sm:block">〜</div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[60px]">
                                        終了時間
                                    </label>
                                    <select
                                        value={endHour}
                                        onChange={(e) => handleEndHourChange(parseInt(e.target.value))}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    >
                                        {hourOptions.filter(h => h >= 1).map(h => (
                                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* プレビュー */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">プレビュー</p>
                                <div className="relative h-8 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="absolute top-0 bottom-0 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-300"
                                        style={{
                                            left: `${(startHour / 24) * 100}%`,
                                            width: `${((endHour - startHour) / 24) * 100}%`,
                                        }}
                                    />
                                    {/* 時間マーカー */}
                                    {[0, 6, 12, 18, 24].map(h => (
                                        <div
                                            key={h}
                                            className="absolute top-full mt-1 -translate-x-1/2 text-[10px] text-slate-400"
                                            style={{ left: `${(h / 24) * 100}%` }}
                                        >
                                            {h}時
                                        </div>
                                    ))}
                                </div>
                                <p className="text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-5">
                                    {String(startHour).padStart(2, '0')}:00 〜 {String(endHour).padStart(2, '0')}:00
                                    <span className="ml-2 text-slate-400 text-xs">({endHour - startHour}時間)</span>
                                </p>
                            </div>

                            {/* バリデーションエラー */}
                            {startHour >= endHour && (
                                <p className="text-sm text-red-500 font-medium">
                                    ⚠ 開始時間は終了時間より前に設定してください
                                </p>
                            )}
                            {endHour - startHour > 0 && endHour - startHour < 2 && (
                                <p className="text-sm text-red-500 font-medium">
                                    ⚠ 営業時間は最低2時間必要です
                                </p>
                            )}

                            {/* 休館日設定 */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 block mb-3">
                                    休館日（定休日）
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((dayName, idx) => {
                                        const isClosed = closedDays.includes(idx);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => toggleClosedDay(idx)}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                                    isClosed 
                                                        ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/40 dark:border-red-800 dark:text-red-400' 
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                {dayName}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    選択した曜日は自動でスケジュールから除外されます。
                                </p>
                            </div>

                            {/* 保存ボタン */}
                            {hoursModified && (
                                <div className="flex justify-end animate-in slide-in-from-bottom-2 pt-2">
                                    <button
                                        onClick={handleSaveBusinessHours}
                                        disabled={updateBusinessHoursMutation.isPending || startHour >= endHour || endHour - startHour < 2}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {updateBusinessHoursMutation.isPending ? (
                                            <span className="animate-pulse">保存中...</span>
                                        ) : (
                                            '営業時間設定を保存'
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AppearanceSettings;
