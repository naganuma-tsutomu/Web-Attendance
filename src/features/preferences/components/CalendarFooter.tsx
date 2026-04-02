import { Save, X, CheckCircle2 } from 'lucide-react';
import type { DayStatus, AllPrefsForMonth } from '../types';

interface CalendarFooterProps {
    preferences: DayStatus[];
    selectedStaffId: string;
    allPrefsForMonth: AllPrefsForMonth;
    handleSave: () => void;
    saving: boolean;
    prefLoading: boolean;
    handleToggleSubmitted: (submitted: boolean) => void;
    updatingSubmitted: boolean;
}

const CalendarFooter = ({
    preferences,
    selectedStaffId,
    allPrefsForMonth,
    handleSave,
    saving,
    prefLoading,
    handleToggleSubmitted,
    updatingSubmitted,
}: CalendarFooterProps) => {
    const isSubmitted = allPrefsForMonth[selectedStaffId]?.submitted === true;

    return (
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center gap-3 flex-wrap">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                不可: <span className="font-semibold text-red-600 dark:text-red-400">
                    {preferences.filter(p => p.status === 'unavailable' && p.type !== 'training').length} 日
                </span>
                <span className="mx-2">/</span>
                研修: <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {preferences.filter(p => p.status === 'unavailable' && p.type === 'training').length} 日
                </span>
            </p>
            <div className="flex items-center gap-2">
                {isSubmitted ? (
                    <button
                        onClick={() => handleToggleSubmitted(false)}
                        disabled={updatingSubmitted || prefLoading}
                        className={`flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl shadow-sm transition-colors font-medium text-sm ${(updatingSubmitted || prefLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <X className="w-4 h-4" />
                        {updatingSubmitted ? '変更中...' : '未提出に戻す'}
                    </button>
                ) : (
                    <button
                        onClick={() => handleToggleSubmitted(true)}
                        disabled={updatingSubmitted || prefLoading}
                        className={`flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-sm transition-colors font-medium text-sm ${(updatingSubmitted || prefLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {updatingSubmitted ? '変更中...' : '提出済みにする'}
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || prefLoading}
                    className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-sm transition-colors font-medium text-sm ${(saving || prefLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存'}
                </button>
            </div>
        </div>
    );
};

export default CalendarFooter;
