import { Loader2 } from 'lucide-react';
import ClassColorPicker from './ClassColorPicker';

interface NewClassForm {
    name: string;
    color: string;
    auto_allocate: number;
}

interface NewClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    newForm: NewClassForm;
    setNewForm: React.Dispatch<React.SetStateAction<NewClassForm>>;
    isCreating: boolean;
    onSubmit: () => void;
}

const NewClassModal = ({ isOpen, onClose, newForm, setNewForm, isCreating, onSubmit }: NewClassModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in-95">
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: newForm.color }}
                    >
                        {newForm.name.charAt(0) || '＋'}
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white">新規クラス追加</h3>
                </div>

                <div className="px-6 py-8 space-y-8">
                    <div className="space-y-2.5">
                        <label htmlFor="new-class-name" className="block text-sm font-bold text-slate-600 dark:text-slate-300">クラス名</label>
                        <input
                            id="new-class-name"
                            type="text"
                            value={newForm.name}
                            onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                            className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-base dark:text-white transition-all outline-none font-bold"
                            onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
                            placeholder="例：虹組"
                        />
                    </div>

                    <div className="space-y-3">
                        <p className="block text-sm font-bold text-slate-600 dark:text-slate-300">クラスカラー</p>
                        <ClassColorPicker value={newForm.color} onChange={c => setNewForm({ ...newForm, color: c })} />
                    </div>

                    <div className="space-y-3">
                        <p className="block text-sm font-bold text-slate-600 dark:text-slate-300">自動割り当て</p>
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => setNewForm({ ...newForm, auto_allocate: newForm.auto_allocate === 1 ? 0 : 1 })}
                                className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 flex-shrink-0 ${
                                    newForm.auto_allocate === 1 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                role="switch"
                                aria-checked={newForm.auto_allocate === 1}
                                aria-label="自動割り当てを有効にする"
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                                    newForm.auto_allocate === 1 ? 'translate-x-7' : 'translate-x-1'
                                }`} />
                            </button>
                            <span className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                                {newForm.auto_allocate === 1
                                    ? 'ON：シフト自動生成の対象になります'
                                    : 'OFF：手動配置専用（自動生成でスキップ）'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={isCreating || !newForm.name.trim()}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                        追加
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewClassModal;
