import { Trash2 } from 'lucide-react';

interface DeleteRequirementConfirmProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

const DeleteRequirementConfirm = ({ isOpen, onCancel, onConfirm }: DeleteRequirementConfirmProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onCancel} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">時間帯を削除</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">この操作は取り消せません</p>
                    </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">この時間帯設定を削除しますか？</p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                    >
                        削除する
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteRequirementConfirm;
