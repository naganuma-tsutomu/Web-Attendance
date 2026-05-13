import { Plus } from 'lucide-react';
import type { ShiftClass, ShiftRequirement } from '../../../types';

interface ClassSelectorProps {
    classes: ShiftClass[];
    requirements: ShiftRequirement[];
    selectedClassId: string;
    onSelect: (id: string) => void;
    onAdd: () => void;
}

const ClassSelector = ({ classes, requirements, selectedClassId, onSelect, onAdd }: ClassSelectorProps) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
            {classes.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">クラスがまだ登録されていません</p>
            ) : (
                classes.map((cls) => {
                    const isActive = selectedClassId === cls.id;
                    const count = requirements.filter(r => r.classId === cls.id).length;
                    return (
                        <button
                            key={cls.id}
                            onClick={() => onSelect(cls.id)}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                                isActive
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color || '#818cf8' }} />
                            <span>{cls.name}</span>
                            {count > 0 && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                                    isActive
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })
            )}
            <button
                onClick={onAdd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
            >
                <Plus className="w-4 h-4" />
                <span>新規追加</span>
            </button>
        </div>
    </div>
);

export default ClassSelector;
