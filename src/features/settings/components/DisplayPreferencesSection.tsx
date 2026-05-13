import { BarChart3, Moon, Sun } from 'lucide-react';

interface DisplayPreferencesSectionProps {
    theme: 'light' | 'dark';
    weekStartsOn: 0 | 1;
    autoOpenGenerationReport: boolean;
    modified: boolean;
    onThemeChange: (theme: 'light' | 'dark') => void;
    onWeekStartsOnChange: (day: 0 | 1) => void;
    onAutoOpenGenerationReportChange: (enabled: boolean) => void;
    onSave: () => void;
    saving?: boolean;
}

const DisplayPreferencesSection = ({
    theme,
    weekStartsOn,
    autoOpenGenerationReport,
    modified,
    onThemeChange,
    onWeekStartsOnChange,
    onAutoOpenGenerationReportChange,
    onSave,
    saving = false,
}: DisplayPreferencesSectionProps) => (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="space-y-8">
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                    <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">カラーテーマ</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">アプリ全体の配色を切り替えます。</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start sm:self-auto">
                    <button
                        onClick={() => onThemeChange('light')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Sun className="w-4 h-4" />
                        <span className="sm:inline">ライト</span>
                    </button>
                    <button
                        onClick={() => onThemeChange('dark')}
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
                        onClick={() => onWeekStartsOnChange(0)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 0 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        日曜日
                    </button>
                    <button
                        onClick={() => onWeekStartsOnChange(1)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${weekStartsOn === 1 ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        月曜日
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-600" />
                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">生成レポート</p>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">自動生成後に生成レポートを自動で表示します。</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-label="自動生成後に生成レポートを表示"
                    aria-checked={autoOpenGenerationReport}
                    onClick={() => onAutoOpenGenerationReportChange(!autoOpenGenerationReport)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${autoOpenGenerationReport ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoOpenGenerationReport ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                </button>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                    ※ 現時点ではダークモードは一部の画面で正しく表示されない場合があります。順次対応中です。
                </p>
            </div>

            {modified && (
                <div className="flex justify-end animate-in slide-in-from-bottom-2 pt-2">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                    >
                        {saving ? '保存中...' : '表示設定を保存'}
                    </button>
                </div>
            )}
        </div>
    </div>
);

export default DisplayPreferencesSection;
