import React from 'react';
import { Calendar, Users, FileSpreadsheet } from 'lucide-react';

interface AppLayoutProps {
    children: React.ReactNode;
    currentView: 'shift' | 'employees';
    onViewChange: (view: 'shift' | 'employees') => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, currentView, onViewChange }) => {
    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-700">
                    <h1 className="text-lg font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <Calendar className="h-5 w-5" />
                        シフト作成アプリ
                    </h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <button
                        onClick={() => onViewChange('shift')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${currentView === 'shift' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <Calendar className="h-4 w-4" />
                        シフト作成
                    </button>
                    <button
                        onClick={() => onViewChange('employees')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${currentView === 'employees' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <Users className="h-4 w-4" />
                        従業員管理
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md font-medium transition-colors cursor-not-allowed opacity-50">
                        <FileSpreadsheet className="h-4 w-4" />
                        設定
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end px-6 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">ユーザー名</span>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                            U
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900 border-t border-transparent">
                    <div className="mx-auto max-w-6xl">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AppLayout;
