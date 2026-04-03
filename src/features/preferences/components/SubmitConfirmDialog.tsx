import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { Staff } from '../../../types';

interface SubmitConfirmDialogProps {
    confirmSubmit: { submitted: boolean };
    setConfirmSubmit: (v: { submitted: boolean } | null) => void;
    selectedStaff: Staff | undefined;
    targetDate: Date;
    handleConfirmSubmitted: () => void;
    updatingSubmitted: boolean;
}

const SubmitConfirmDialog = ({
    confirmSubmit,
    setConfirmSubmit,
    selectedStaff,
    targetDate,
    handleConfirmSubmitted,
    updatingSubmitted,
}: SubmitConfirmDialogProps) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmSubmit(null)} />
        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
                {confirmSubmit.submitted ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                )}
                <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {confirmSubmit.submitted ? '提出済みにする' : '未提出に戻す'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedStaff?.name} の {format(targetDate, 'yyyy年M月', { locale: ja })}
                    </p>
                </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                {confirmSubmit.submitted
                    ? 'この操作により提出済みとしてマークされます。'
                    : 'この操作により未提出状態に戻ります。'}
            </p>
            <div className="flex gap-2">
                <button
                    onClick={() => setConfirmSubmit(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    キャンセル
                </button>
                <button
                    onClick={handleConfirmSubmitted}
                    disabled={updatingSubmitted}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm text-white transition-colors flex items-center justify-center gap-2 ${
                        confirmSubmit.submitted
                            ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600'
                            : 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600'
                    } ${updatingSubmitted ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {updatingSubmitted ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {confirmSubmit.submitted ? '提出済みにする' : '未提出に戻す'}
                </button>
            </div>
        </div>
    </div>
);

export default SubmitConfirmDialog;
