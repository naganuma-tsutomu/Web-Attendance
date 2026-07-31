import { Plus, Loader2, Trash2 } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { ShiftRequirement } from '../../../types';
import SortableRequirementRow from './SortableRequirementRow';

interface ClassRequirementsCardProps {
    requirements: ShiftRequirement[];
    isDirty: boolean;
    isSaving: boolean;
    onAdd: () => void;
    onUpdate: (id: string, updates: Partial<ShiftRequirement>) => void;
    onDeleteRequest: (id: string) => void;
    onDeleteAllRequest: () => void;
    onDragEnd: (event: DragEndEvent) => void;
    onCancel: () => void;
    onSave: () => void;
}

const ClassRequirementsCard = ({
    requirements,
    isDirty,
    isSaving,
    onAdd,
    onUpdate,
    onDeleteRequest,
    onDeleteAllRequest,
    onDragEnd,
    onCancel,
    onSave,
}: ClassRequirementsCardProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">必要人数設定</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">{requirements.length} 件</span>
                        <button
                            type="button"
                            onClick={onDeleteAllRequest}
                            disabled={requirements.length === 0 || isSaving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-4 h-4" />
                            一括削除
                        </button>
                    </div>
                </div>

                {requirements.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        <p className="text-sm">時間帯の設定がありません</p>
                        <p className="text-xs mt-1 text-slate-400">「時間帯を追加」ボタンから設定を追加してください</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={requirements.map(r => r.id)} strategy={verticalListSortingStrategy}>
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                {requirements.map((req, index) => (
                                    <SortableRequirementRow
                                        key={req.id}
                                        req={req}
                                        index={index}
                                        onUpdate={onUpdate}
                                        onDeleteRequest={onDeleteRequest}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        onClick={onAdd}
                        className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        <span>時間帯を追加</span>
                    </button>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                {isDirty && (
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="px-6 py-3 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                    >
                        キャンセル
                    </button>
                )}
                <button
                    onClick={onSave}
                    disabled={isSaving || !isDirty}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>保存中...</span>
                        </>
                    ) : (
                        <span>必要人数を保存</span>
                    )}
                </button>
            </div>
        </>
    );
};

export default ClassRequirementsCard;
