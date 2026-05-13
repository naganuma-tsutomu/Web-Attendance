import { Loader2, Save, Trash2, UserCheck } from 'lucide-react';
import type { ShiftClass } from '../../../types';
import ClassColorPicker from './ClassColorPicker';

export interface ClassBasicForm {
    name: string;
    color: string;
    auto_allocate: number;
}

interface ClassBasicInfoCardProps {
    selectedClass: ShiftClass;
    staffCount: number;
    form: ClassBasicForm;
    setForm: React.Dispatch<React.SetStateAction<ClassBasicForm>>;
    isDirty: boolean;
    isSaving: boolean;
    onSave: () => void;
    onDelete: () => void;
}

const ClassBasicInfoCard = ({
    selectedClass,
    staffCount,
    form,
    setForm,
    isDirty,
    isSaving,
    onSave,
    onDelete,
}: ClassBasicInfoCardProps) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0"
                style={{ backgroundColor: form.color }}
            >
                {form.name.charAt(0) || selectedClass.name.charAt(0)}
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">基本情報</h3>
            {staffCount > 0 && (
                <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg gap-1 ml-auto">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>所属スタッフ {staffCount}名</span>
                </div>
            )}
        </div>

        <div className="px-6 py-8 sm:px-10 space-y-8">
            <div className="space-y-2.5">
                <label htmlFor="class-name" className="block text-sm font-bold text-slate-600 dark:text-slate-300">クラス名</label>
                <input
                    id="class-name"
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full sm:max-w-sm px-4 py-3.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-base dark:text-white transition-all outline-none font-bold"
                    onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
                />
            </div>

            <div className="space-y-3">
                <p className="block text-sm font-bold text-slate-600 dark:text-slate-300">クラスカラー</p>
                <ClassColorPicker value={form.color} onChange={color => setForm({ ...form, color })} />
            </div>

            <div className="space-y-3">
                <p className="block text-sm font-bold text-slate-600 dark:text-slate-300">自動割り当て</p>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setForm({ ...form, auto_allocate: form.auto_allocate === 1 ? 0 : 1 })}
                        className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 flex-shrink-0 ${
                            form.auto_allocate === 1 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        role="switch"
                        aria-checked={form.auto_allocate === 1}
                        aria-label="自動割り当てを有効にする"
                    >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                            form.auto_allocate === 1 ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                    </button>
                    <span className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                        {form.auto_allocate === 1
                            ? 'ON：シフト自動生成の対象になります'
                            : 'OFF：手動配置専用（自動生成でスキップ）'}
                    </span>
                </div>
            </div>
        </div>

        <div className="px-6 pb-8 sm:px-10 flex gap-3 justify-end">
            <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
                <Trash2 className="w-4 h-4" />
                削除
            </button>
            <button
                onClick={onSave}
                disabled={isSaving || !isDirty || !form.name.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
            </button>
        </div>
    </div>
);

export default ClassBasicInfoCard;
