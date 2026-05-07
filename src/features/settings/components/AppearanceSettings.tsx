import { Moon, Sun, Clock, Building2, Coffee, Hash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useBusinessHours, useUpdateBusinessHours, useFacilityName, useUpdateFacilityName, useBreakSettings, useUpdateBreakSettings, useExcelSettings, useUpdateExcelSettings } from '../../../lib/hooks';
import { getWeekStartsOn, setWeekStartsOn as saveWeekStartsOn, STORAGE_KEYS } from '../../../utils/dateUtils';
import { DEFAULT_BREAK_SETTINGS } from '../../../utils/timeUtils';
import type { BreakSettings } from '../../../types';

const AppearanceSettings = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
    });
    const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => getWeekStartsOn());
    const [appearanceModified, setAppearanceModified] = useState(false);

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        setAppearanceModified(true);
    };

    const handleWeekStartsOnChange = (newDay: 0 | 1) => {
        setWeekStartsOn(newDay);
        setAppearanceModified(true);
    };

    const handleSaveAppearance = () => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
        saveWeekStartsOn(weekStartsOn);
        setAppearanceModified(false);
        toast.success('表示設定を保存しました');
    };

    // 施設名設定
    const { data: facilityNameData } = useFacilityName();
    const updateFacilityNameMutation = useUpdateFacilityName();
    const [facilityName, setFacilityName] = useState('');
    const [facilityNameModified, setFacilityNameModified] = useState(false);

    useEffect(() => {
        if (facilityNameData !== undefined) {
            setFacilityName(facilityNameData);
            setFacilityNameModified(false);
        }
    }, [facilityNameData]);

    const handleSaveFacilityName = async () => {
        try {
            await updateFacilityNameMutation.mutateAsync(facilityName);
            toast.success('施設名を保存しました');
            setFacilityNameModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

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

    // 当番番号設定
    const { data: excelSettingsData } = useExcelSettings();
    const updateExcelSettingsMutation = useUpdateExcelSettings();
    const [showDutyNumbers, setShowDutyNumbers] = useState(false);
    const [leaderIsFullTimeOnly, setLeaderIsFullTimeOnly] = useState(false);
    const [dutyModified, setDutyModified] = useState(false);

    useEffect(() => {
        if (excelSettingsData) {
            setShowDutyNumbers(excelSettingsData.showDutyNumbers ?? false);
            setLeaderIsFullTimeOnly(excelSettingsData.leaderIsFullTimeOnly ?? false);
            setDutyModified(false);
        }
    }, [excelSettingsData]);

    const handleSaveDutySettings = async () => {
        if (!excelSettingsData) return;
        try {
            await updateExcelSettingsMutation.mutateAsync({
                ...excelSettingsData,
                showDutyNumbers,
                leaderIsFullTimeOnly,
            });
            toast.success('当番番号設定を保存しました');
            setDutyModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    // 0:00〜24:00を30分刻みで生成 (0, 0.5, 1, 1.5, ..., 24)
    const hourOptions = Array.from({ length: 49 }, (_, i) => i * 0.5);
    const formatHour = (h: number) => {
        const hh = Math.floor(h);
        const mm = h % 1 === 0.5 ? '30' : '00';
        return `${String(hh).padStart(2, '0')}:${mm}`;
    };
    const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土', '祝日'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* 施設名設定 */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-indigo-500" />
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">施設名</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">サイドバーに表示される施設名を設定します。</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={facilityName}
                            onChange={(e) => { setFacilityName(e.target.value); setFacilityNameModified(true); }}
                            maxLength={50}
                            placeholder="施設名を入力"
                            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        />
                        {facilityNameModified && (
                            <button
                                onClick={handleSaveFacilityName}
                                disabled={updateFacilityNameMutation.isPending || !facilityName.trim()}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {updateFacilityNameMutation.isPending ? '保存中...' : '保存'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="space-y-8">
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">カラーテーマ</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">アプリ全体の配色を切り替えます。</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start sm:self-auto">
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Sun className="w-4 h-4" />
                                <span className="sm:inline">ライト</span>
                            </button>
                            <button
                                onClick={() => handleThemeChange('dark')}
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
                                onClick={() => handleWeekStartsOnChange(0)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 0 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                日曜日
                            </button>
                            <button
                                onClick={() => handleWeekStartsOnChange(1)}
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

                    {appearanceModified && (
                        <div className="flex justify-end animate-in slide-in-from-bottom-2 pt-2">
                            <button
                                onClick={handleSaveAppearance}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                            >
                                表示設定を保存
                            </button>
                        </div>
                    )}
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
                                        onChange={(e) => handleStartHourChange(parseFloat(e.target.value))}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    >
                                        {hourOptions.filter(h => h < 24).map(h => (
                                            <option key={h} value={h}>{formatHour(h)}</option>
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
                                        onChange={(e) => handleEndHourChange(parseFloat(e.target.value))}
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    >
                                        {hourOptions.filter(h => h >= 1).map(h => (
                                            <option key={h} value={h}>{formatHour(h)}</option>
                                        ))}
                                    </select>
                                </div>
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

            {/* 休憩設定 */}
            <BreakSettingsSection />

            {/* 当番番号設定 */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <Hash className="w-5 h-5 text-indigo-500" />
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">当番番号</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">シフト作成画面とExcel出力に番号カラムを表示します。</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">番号カラムを表示する</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">シフト作成画面とExcel出力の両方に当番番号（1, 2, 3...）の列を表示します。</p>
                        </div>
                        <button
                            onClick={() => { setShowDutyNumbers(v => !v); setDutyModified(true); }}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${showDutyNumbers ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDutyNumbers ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">1番を正社員のみで回す</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ONにすると、リーダー番号（1番）は正社員フラグが付いた区分のスタッフのみでローテーションします。</p>
                        </div>
                        <button
                            onClick={() => { setLeaderIsFullTimeOnly(v => !v); setDutyModified(true); }}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${leaderIsFullTimeOnly ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${leaderIsFullTimeOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
                {dutyModified && (
                    <div className="flex justify-end mt-6 animate-in slide-in-from-bottom-2">
                        <button
                            onClick={handleSaveDutySettings}
                            disabled={updateExcelSettingsMutation.isPending}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updateExcelSettingsMutation.isPending ? '保存中...' : '当番番号設定を保存'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// 休憩設定コンポーネント
const BreakSettingsSection = () => {
    const { data: breakSettingsData, isLoading: isLoadingBreak } = useBreakSettings();
    const updateBreakMutation = useUpdateBreakSettings();
    const [breakSettings, setBreakSettings] = useState<BreakSettings>(DEFAULT_BREAK_SETTINGS);
    const [breakModified, setBreakModified] = useState(false);

    useEffect(() => {
        if (breakSettingsData) {
            setBreakSettings(breakSettingsData);
            setBreakModified(false);
        }
    }, [breakSettingsData]);

    const handleBreakChange = (patch: Partial<BreakSettings>) => {
        setBreakSettings(prev => ({ ...prev, ...patch }));
        setBreakModified(true);
    };

    const handleSaveBreakSettings = async () => {
        try {
            await updateBreakMutation.mutateAsync(breakSettings);
            toast.success('休憩設定を保存しました');
            setBreakModified(false);
        } catch {
            toast.error('保存に失敗しました');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <Coffee className="w-5 h-5 text-indigo-500" />
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">休憩設定</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            労働基準法に基づく休憩時間の自動計算と、例外ルールを設定します。
                        </p>
                    </div>
                </div>

                {isLoadingBreak ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-slate-400 text-sm animate-pulse">読み込み中...</div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* 法定休憩の説明 */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">法定休憩（自動適用）</p>
                            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <p>• 労働時間が <span className="font-bold text-slate-700 dark:text-slate-300">8時間超</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">60分</span></p>
                                <p>• 労働時間が <span className="font-bold text-slate-700 dark:text-slate-300">6時間超〜8時間</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">45分</span></p>
                                <p>• 労働時間が <span className="font-bold text-slate-700 dark:text-slate-300">6時間以下</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">休憩なし</span></p>
                            </div>
                        </div>

                        {/* 例外ルール */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">例外休憩ルール</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        指定時刻までに出勤したスタッフに例外的に休憩を付与します。
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleBreakChange({ exceptionEnabled: !breakSettings.exceptionEnabled })}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                        breakSettings.exceptionEnabled
                                            ? 'bg-indigo-600'
                                            : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        breakSettings.exceptionEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                                </button>
                            </div>

                            {breakSettings.exceptionEnabled && (
                                <div className="ml-0 sm:ml-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[80px] whitespace-nowrap">
                                                判定時刻
                                            </label>
                                            <input
                                                type="time"
                                                value={breakSettings.exceptionThresholdTime}
                                                onChange={(e) => handleBreakChange({ exceptionThresholdTime: e.target.value })}
                                                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[80px] whitespace-nowrap">
                                                休憩時間
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={120}
                                                    value={breakSettings.exceptionBreakMinutes}
                                                    onChange={(e) => handleBreakChange({ exceptionBreakMinutes: parseInt(e.target.value) || 0 })}
                                                    className="w-20 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                                />
                                                <span className="text-sm text-slate-500 dark:text-slate-400">分</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                        ※ 出勤時刻が判定時刻以前の場合に例外休憩を適用します。ただし、法定休憩の方が大きい場合は法定休憩が優先されます。
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 表示設定 */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">表示設定</p>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">シフトモーダルの時間表示</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {breakSettings.displayActualHoursInModal ? '実労働時間（休憩差引き）で表示' : 'シフト時間で表示'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleBreakChange({ displayActualHoursInModal: !breakSettings.displayActualHoursInModal })}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                            breakSettings.displayActualHoursInModal
                                                ? 'bg-indigo-600'
                                                : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            breakSettings.displayActualHoursInModal ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">Excel出力の実働列</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {breakSettings.displayActualHoursInExcel ? '実労働時間（休憩差引き）で出力' : 'シフト時間で出力'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleBreakChange({ displayActualHoursInExcel: !breakSettings.displayActualHoursInExcel })}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                            breakSettings.displayActualHoursInExcel
                                                ? 'bg-indigo-600'
                                                : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            breakSettings.displayActualHoursInExcel ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 保存ボタン */}
                        {breakModified && (
                            <div className="flex justify-end animate-in slide-in-from-bottom-2 pt-2">
                                <button
                                    onClick={handleSaveBreakSettings}
                                    disabled={updateBreakMutation.isPending}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {updateBreakMutation.isPending ? (
                                        <span className="animate-pulse">保存中...</span>
                                    ) : (
                                        '休憩設定を保存'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
};

export default AppearanceSettings;
