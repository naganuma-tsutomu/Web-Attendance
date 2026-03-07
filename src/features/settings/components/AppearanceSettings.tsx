import { Moon, Sun, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

const AppearanceSettings = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    });
    const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(() => {
        return (parseInt(localStorage.getItem('weekStartsOn') || '0') as 0 | 1);
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('weekStartsOn', weekStartsOn.toString());
    }, [weekStartsOn]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center space-x-2">
                    <Palette className="w-5 h-5 text-indigo-500" />
                    <span>外観設定</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    アプリケーションの表示テーマやカレンダーの設定を変更します。
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white">カラーテーマ</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">アプリ全体の配色を切り替えます。</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                            <button
                                onClick={() => setTheme('light')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Sun className="w-4 h-4" />
                                <span className="hidden sm:inline">ライト</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'dark' ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Moon className="w-4 h-4" />
                                <span className="hidden sm:inline">ダーク</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white">週の開始日</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">カレンダーの表示を開始する曜日を選択します。</p>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
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
        </div>
    );
};

export default AppearanceSettings;
