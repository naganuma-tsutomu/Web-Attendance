import { AlertCircle, Loader2, Plus, Users } from 'lucide-react';

type StaffPageHeaderProps = {
    error: string;
    isLoading: boolean;
    onAdd: () => void;
    onRetry: () => void;
};

const StaffPageHeader = ({ error, isLoading, onAdd, onRetry }: StaffPageHeaderProps) => (
    <>
        <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500" />
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">スタッフ管理</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">スタッフの登録情報とスタッフ区分の割り当てを管理します</p>
            </div>
        </div>

        <div className="flex justify-end">
            <button
                onClick={onAdd}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all font-bold text-sm"
            >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">スタッフ追加</span>
                <span className="sm:hidden">追加</span>
            </button>
        </div>

        {error && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start justify-between gap-3 animate-in fade-in" role="alert">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-800 font-medium dark:text-amber-300">{error}</span>
                </div>
                <button
                    onClick={onRetry}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    再試行
                </button>
            </div>
        )}
    </>
);

export default StaffPageHeader;
