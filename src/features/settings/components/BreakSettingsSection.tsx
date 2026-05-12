import { useState, useEffect } from 'react';
import { Coffee } from 'lucide-react';
import { toast } from 'sonner';
import { useBreakSettings, useUpdateBreakSettings } from '../../../lib/hooks';
import { DEFAULT_BREAK_SETTINGS } from '../../../utils/timeUtils';
import type { BreakSettings } from '../../../types';

const BreakSettingsSection = () => {
    const { data: breakSettingsData, isLoading: isLoadingBreak } = useBreakSettings();
    const updateBreakMutation = useUpdateBreakSettings();
    const [breakSettings, setBreakSettings] = useState<BreakSettings>(DEFAULT_BREAK_SETTINGS);
    const [breakModified, setBreakModified] = useState(false);

    useEffect(() => {
        if (breakSettingsData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">法定休憩（自動適用）</p>
                            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <p>• 労働時間が <span className="font-bold text-slate-700 dark:text-slate-300">8時間超</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">60分</span></p>
                                <p>• 労働時間が <span className="font-bold text-slate-700 dark:text-slate-300">6時間超〜8時間</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">45分</span></p>
                                <p>• 労働時間が <span className="font-bold text-slate-700 dark:text-slate-300">6時間以下</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">休憩なし</span></p>
                            </div>
                        </div>

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
                                    role="switch"
                                    aria-checked={breakSettings.exceptionEnabled}
                                    aria-label="例外休憩ルールを有効にする"
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                        breakSettings.exceptionEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
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
                                        role="switch"
                                        aria-checked={breakSettings.displayActualHoursInModal}
                                        aria-label="シフトモーダルの時間表示を実労働時間にする"
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                            breakSettings.displayActualHoursInModal ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
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
                                        role="switch"
                                        aria-checked={breakSettings.displayActualHoursInExcel}
                                        aria-label="Excel出力を実労働時間にする"
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                            breakSettings.displayActualHoursInExcel ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            breakSettings.displayActualHoursInExcel ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                    </button>
                                </div>
                            </div>
                        </div>

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

export default BreakSettingsSection;
