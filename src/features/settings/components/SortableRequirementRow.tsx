import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ShiftRequirement } from '../../../types';
import { SHIFT_DAY } from '../../../constants';

export const dayOfWeekOptions = [
    { value: SHIFT_DAY.WEEKDAYS, label: '平日（月〜金）' },
    { value: 1, label: '月曜日' },
    { value: 2, label: '火曜日' },
    { value: 3, label: '水曜日' },
    { value: 4, label: '木曜日' },
    { value: 5, label: '金曜日' },
    { value: 6, label: '土曜日' },
    { value: 0, label: '日曜日' },
];

export const priorityOptions = [
    { value: 1, label: '低', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700' },
    { value: 2, label: '中低', color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' },
    { value: 3, label: '中', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30' },
    { value: 4, label: '中高', color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30' },
    { value: 5, label: '高', color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' },
];

interface SortableRequirementRowProps {
    req: ShiftRequirement;
    index: number;
    onUpdate: (id: string, updates: Partial<ShiftRequirement>) => void;
    onDeleteRequest: (id: string) => void;
}

const SortableRequirementRow = ({ req, index, onUpdate, onDeleteRequest }: SortableRequirementRowProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: req.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <div ref={setNodeRef} style={style}
            className="px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">

            {/* xl+: 1行レイアウト */}
            <div className="hidden xl:flex items-center gap-2">
                <button {...attributes} {...listeners}
                    aria-label="ドラッグして並び替え"
                    className="p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing rounded flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                </button>
                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                </div>
                <select value={req.dayOfWeek}
                    onChange={(e) => onUpdate(req.id, { dayOfWeek: parseInt(e.target.value) })}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    {dayOfWeekOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <input type="time" value={req.startTime}
                    onChange={(e) => onUpdate(req.id, { startTime: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                <span className="text-slate-400 text-sm flex-shrink-0">〜</span>
                <input type="time" value={req.endTime}
                    onChange={(e) => onUpdate(req.id, { endTime: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                <div className="flex items-center gap-1 flex-shrink-0">
                    <input type="number" min={1} max={20} value={req.minStaffCount}
                        onChange={(e) => onUpdate(req.id, { minStaffCount: parseInt(e.target.value) || 1 })}
                        className="w-14 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">名</span>
                </div>
                <select value={req.priority}
                    onChange={(e) => onUpdate(req.id, { priority: parseInt(e.target.value) })}
                    className={`w-16 h-[38px] px-1 py-2 rounded-lg border-0 text-sm font-medium text-center cursor-pointer flex-shrink-0 ${
                        priorityOptions.find(p => p.value === req.priority)?.color || priorityOptions[2].color
                    }`}>
                    {priorityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <button onClick={() => onDeleteRequest(req.id)}
                    className="ml-auto p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                    title="削除">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* ～xl: 2行レイアウト */}
            <div className="xl:hidden space-y-2">
                {/* 1行目: grip + 番号 + 曜日 + 優先度 + 削除 */}
                <div className="flex items-center gap-2">
                    <button {...attributes} {...listeners}
                        aria-label="ドラッグして並び替え"
                        className="p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing rounded flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                    </button>
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                    </div>
                    <select value={req.dayOfWeek}
                        onChange={(e) => onUpdate(req.id, { dayOfWeek: parseInt(e.target.value) })}
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        {dayOfWeekOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select value={req.priority}
                        onChange={(e) => onUpdate(req.id, { priority: parseInt(e.target.value) })}
                        className={`w-16 h-[38px] px-1 py-2 rounded-lg border-0 text-sm font-medium text-center cursor-pointer flex-shrink-0 ${
                            priorityOptions.find(p => p.value === req.priority)?.color || priorityOptions[2].color
                        }`}>
                        {priorityOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button onClick={() => onDeleteRequest(req.id)}
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                        title="削除">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                {/* 2行目: 開始〜終了 + 人数 */}
                <div className="flex items-center gap-2 pl-9">
                    <input type="time" value={req.startTime}
                        onChange={(e) => onUpdate(req.id, { startTime: e.target.value })}
                        className="flex-1 min-w-0 px-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <span className="text-slate-400 text-sm flex-shrink-0">〜</span>
                    <input type="time" value={req.endTime}
                        onChange={(e) => onUpdate(req.id, { endTime: e.target.value })}
                        className="flex-1 min-w-0 px-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <input type="number" min={1} max={20} value={req.minStaffCount}
                            onChange={(e) => onUpdate(req.id, { minStaffCount: parseInt(e.target.value) || 1 })}
                            className="w-14 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">名</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SortableRequirementRow;
