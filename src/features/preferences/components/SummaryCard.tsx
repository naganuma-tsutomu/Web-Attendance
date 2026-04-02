import { Users } from 'lucide-react';

interface SummaryCardProps {
    submittedCount: number;
    totalCount: number;
}

const SummaryCard = ({ submittedCount, totalCount }: SummaryCardProps) => (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">提出状況</p>
            <p className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
                <span className="text-indigo-600 dark:text-indigo-400 text-lg">{submittedCount}</span>
                <span className="text-slate-400 dark:text-slate-500 text-sm"> / {totalCount} 名</span>
                {submittedCount < totalCount && (
                    <span className="ml-3 text-sm text-amber-600 dark:text-amber-400 font-medium">
                        {totalCount - submittedCount} 名未提出
                    </span>
                )}
                {submittedCount === totalCount && totalCount > 0 && (
                    <span className="ml-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">全員提出済み ✓</span>
                )}
            </p>
        </div>
    </div>
);

export default SummaryCard;
