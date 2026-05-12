import { GripVertical, Trash2, Edit2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DynamicRole } from '../../../types';

interface SortableRoleItemProps {
    role: DynamicRole;
    index: number;
    onDelete?: (id: string) => void;
    onEdit?: () => void;
    isOverlay?: boolean;
}

const SortableRoleItem = ({ role, index, onDelete, onEdit, isOverlay = false }: SortableRoleItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: role.id, disabled: isOverlay });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group ${isOverlay ? 'ring-2 ring-indigo-500 shadow-xl' : ''}`}
        >
            {/* スマホ: コンパクト表示 */}
            <div className="md:hidden p-4 flex items-center gap-3">
                {!isOverlay && (
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 transition-colors p-1 flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}
                <div className="w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                    {index + 1}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
                        {role.name.charAt(0)}
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{role.name}</h4>
                </div>
                {!isOverlay && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={onEdit} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-1.5 rounded-lg transition-all" title="編集">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete?.(role.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-all" title="削除">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* PC: 詳細表示 */}
            <div className="hidden md:flex p-4 items-center gap-4">
                {!isOverlay && (
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 transition-colors p-1 flex-shrink-0">
                        <GripVertical className="w-5 h-5" />
                    </div>
                )}
                <div className="w-10 h-10 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-sm flex-shrink-0">
                    {index + 1}
                </div>
                <div className="flex items-center gap-3 min-w-[150px]">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
                        {role.name.charAt(0)}
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white">{role.name}</h4>
                </div>
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col min-w-[100px]">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-0.5">月間労働時間</span>
                        <span className={`text-sm font-bold ${role.targetHours === null ? 'text-slate-400 italic' : 'text-slate-700 dark:text-white'}`}>
                            {role.targetHours !== null ? `${role.targetHours}時間` : '設定なし'}
                        </span>
                    </div>
                    <div className="flex flex-col min-w-[100px]">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-0.5">週間労働時間</span>
                        <span className={`text-sm font-bold ${role.weeklyHoursTarget === null || role.weeklyHoursTarget === undefined ? 'text-slate-400 italic' : 'text-slate-700 dark:text-white'}`}>
                            {role.weeklyHoursTarget !== null && role.weeklyHoursTarget !== undefined ? `${role.weeklyHoursTarget}時間` : '設定なし'}
                        </span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-[180px]">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-1">利用可能なパターン</span>
                        {role.patterns.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">パターンなし</span>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-xs font-bold">
                                    {role.patterns.length}件
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {role.patterns.slice(0, 2).map(p => (
                                        <span key={p.id} className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-medium">
                                            {p.name}
                                        </span>
                                    ))}
                                    {role.patterns.length > 2 && (
                                        <span className="text-[10px] text-slate-400 font-medium">+{role.patterns.length - 2}</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {!isOverlay && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={onEdit} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-2 rounded-lg transition-all" title="編集">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete?.(role.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all" title="削除">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SortableRoleItem;
