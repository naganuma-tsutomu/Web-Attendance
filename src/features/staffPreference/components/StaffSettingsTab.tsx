import { useState } from 'react';
import { Users, LogOut, MapPin, ChevronRight, Sun, Moon } from 'lucide-react';
import { STORAGE_KEYS } from '../../../utils/dateUtils';

interface StaffSettingsTabProps {
    staff: { id: string; name: string };
    handleLogout: () => void;
}

export default function StaffSettingsTab({ staff, handleLogout }: StaffSettingsTabProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as 'light' | 'dark') || 'light';
    });

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    };

    return (
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

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">テーマ設定</h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => handleThemeChange('light')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${theme === 'light' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Sun className="w-4 h-4" />
                        <span>ライト</span>
                    </button>
                    <button
                        onClick={() => handleThemeChange('dark')}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        <Moon className="w-4 h-4" />
                        <span>ダーク</span>
                    </button>
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
    );
}
