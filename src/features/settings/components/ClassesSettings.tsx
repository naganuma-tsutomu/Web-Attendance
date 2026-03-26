import { useState } from 'react';
import { Plus, Trash2, Users, Loader2, GripVertical, Edit2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createClass, deleteClass, updateClass, updateClassOrder } from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import type { ShiftClass, Staff } from '../../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import ConfirmModal from '../../../components/ui/ConfirmModal';

const CLASS_COLORS = [
    '#818cf8', '#60a5fa', '#34d399', '#fbbf24',
    '#f87171', '#c084fc', '#fb923c', '#f472b6',
    '#2dd4bf', '#94a3b8',
];

const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex flex-wrap gap-2">
        {CLASS_COLORS.map(c => (
            <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={`w-7 h-7 rounded-full transition-all ${value === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
                title={c}
            />
        ))}
    </div>
);

interface ClassesSettingsProps {
    classes: ShiftClass[];
    staffs: Staff[];
    loading: boolean;
    onUpdate: () => void;
    setClasses: React.Dispatch<React.SetStateAction<ShiftClass[]>>;
}

const SortableClassRow = ({ cls, staffCount, onDelete, onEdit, onToggleAllocation, isOverlay = false }: {
    cls: ShiftClass,
    staffCount: number,
    onDelete?: (id: string) => void,
    onEdit?: () => void,
    onToggleAllocation?: () => void,
    isOverlay?: boolean
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: cls.id, disabled: isOverlay });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
    };

    const content = (
        <div className="flex items-center space-x-4 flex-1">
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold flex-shrink-0 shadow-sm relative text-white"
                style={{ backgroundColor: cls.color || '#818cf8' }}
            >
                {cls.name.charAt(0)}
                {staffCount > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm">
                        {staffCount}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{cls.name}</p>
                    {staffCount > 0 && (
                        <div className="flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md">
                            <UserCheck className="w-2.5 h-2.5 mr-1" />
                            <span>{staffCount}名</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-3 mt-1">
                    <label className={`relative inline-flex items-center ${onToggleAllocation ? 'cursor-pointer' : 'cursor-default'} scale-75 origin-left`}>
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={cls.auto_allocate === 1}
                            onChange={() => onToggleAllocation?.()}
                            disabled={!onToggleAllocation}
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-sm border border-slate-200 dark:border-slate-600"></div>
                    </label>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                        自動割り当て: {cls.auto_allocate === 1 ? '有効' : '無効'}
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`px-6 py-4 flex items-center justify-between transition-all ${isOverlay
                ? 'bg-white dark:bg-slate-800 shadow-2xl ring-2 ring-indigo-500 opacity-90 rounded-xl'
                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                } ${isDragging && !isOverlay ? 'bg-indigo-50/30 border-y border-dashed border-indigo-200' : ''}`}
        >
            <div className="flex items-center space-x-4 flex-1 min-w-0">
                {!isOverlay && (
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all flex-shrink-0"
                    >
                        <GripVertical className="w-5 h-5" />
                    </button>
                )}
                {content}
            </div>
            {!isOverlay && (
                <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                        onClick={onEdit}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                        title="編集"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete?.(cls.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                        title="削除"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

const ClassesSettings = ({ classes, staffs, loading, onUpdate, setClasses }: ClassesSettingsProps) => {
    const [newClass, setNewClass] = useState({ name: '', auto_allocate: 1, color: CLASS_COLORS[0] });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<ShiftClass | null>(null);
    const [editForm, setEditForm] = useState({ name: '', color: CLASS_COLORS[0], auto_allocate: 1 });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleOpenAddModal = () => {
        setNewClass({ name: '', auto_allocate: 1, color: CLASS_COLORS[0] });
        setIsAddModalOpen(true);
    };

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClass.name.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await createClass(newClass.name, newClass.auto_allocate, newClass.color);
            setNewClass({ name: '', auto_allocate: 1, color: CLASS_COLORS[0] });
            toast.success(`クラス「${newClass.name}」を追加しました`);
            setIsAddModalOpen(false);
            onUpdate();
        } catch (err) {
            handleApiError(err, 'クラスの追加に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleClassAllocation = async (cls: ShiftClass) => {
        const newValue = cls.auto_allocate === 1 ? 0 : 1;
        try {
            await updateClass(cls.id, { auto_allocate: newValue });
            toast.success(`設定を${newValue === 1 ? '有効' : '無効'}に更新しました`);
            onUpdate();
        } catch (err) {
            handleApiError(err, '設定の更新に失敗しました');
        }
    };

    const handleDeleteClick = (cls: ShiftClass) => {
        setDeleteConfirm({ id: cls.id, name: cls.name });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm || isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteClass(deleteConfirm.id);
            toast.success(`クラス「${deleteConfirm.name}」を削除しました`);
            setDeleteConfirm(null);
            onUpdate();
        } catch (err) {
            handleApiError(err, '削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleOpenEdit = (cls: ShiftClass) => {
        setEditingClass(cls);
        setEditForm({ name: cls.name, color: cls.color || CLASS_COLORS[0], auto_allocate: cls.auto_allocate });
    };

    const handleSaveEdit = async () => {
        if (!editingClass || !editForm.name.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await updateClass(editingClass.id, { name: editForm.name, color: editForm.color, auto_allocate: editForm.auto_allocate });
            setEditingClass(null);
            toast.success('クラスを更新しました');
            onUpdate();
        } catch (err) {
            handleApiError(err, '更新に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleClassDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over || active.id === over.id) return;
        const oldIndex = classes.findIndex(c => c.id === active.id);
        const newIndex = classes.findIndex(c => c.id === over.id);
        const newClasses = arrayMove(classes, oldIndex, newIndex);
        setClasses(newClasses);
        try {
            const orders = newClasses.map((c, index) => ({ id: c.id, order: index }));
            await updateClassOrder(orders);
        } catch (err) {
            handleApiError(err, '並び替えの保存に失敗しました');
            onUpdate();
        }
    };

    const activeClass = activeId ? classes.find(c => c.id === activeId) : null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Add Class Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span>クラス追加</span>
                </button>
            </div>

            {/* Classes list */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider flex items-center">
                        <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                        登録済みクラス
                    </h4>
                    <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm">
                        {classes.length}
                    </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                            <p className="text-sm font-medium">クラスを読み込み中...</p>
                        </div>
                    ) : classes.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Users className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-medium text-slate-400">クラスが１つも登録されていません。</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleClassDragEnd}
                            modifiers={[restrictToVerticalAxis]}
                        >
                            <SortableContext
                                items={classes.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {classes.map(c => (
                                    <SortableClassRow
                                        key={c.id}
                                        cls={c}
                                        staffCount={staffs.filter(s => s.classIds?.includes(c.id)).length}
                                        onDelete={() => handleDeleteClick(c)}
                                        onEdit={() => handleOpenEdit(c)}
                                        onToggleAllocation={() => handleToggleClassAllocation(c)}
                                    />
                                ))}
                            </SortableContext>

                            <DragOverlay dropAnimation={{
                                sideEffects: defaultDropAnimationSideEffects({
                                    styles: { active: { opacity: '0.3' } },
                                }),
                            }}>
                                {activeClass ? (
                                    <div className="w-full">
                                        <SortableClassRow
                                            cls={activeClass}
                                            staffCount={staffs.filter(s => s.classIds?.includes(activeClass.id)).length}
                                            isOverlay
                                        />
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setEditingClass(null)} />
                    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in-95">
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: editForm.color }}
                            >
                                {editForm.name.charAt(0) || editingClass.name.charAt(0)}
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-white">クラスを編集</h3>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-5">
                            {/* クラス名 */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">クラス名</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white transition-all outline-none font-bold"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); }}
                                />
                            </div>

                            {/* クラスカラー */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">クラスカラー</label>
                                <ColorPicker value={editForm.color} onChange={c => setEditForm({ ...editForm, color: c })} />
                            </div>

                            {/* 自動割り当て */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">自動シフト作成の対象にする</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={editForm.auto_allocate === 1}
                                        onChange={e => setEditForm({ ...editForm, auto_allocate: e.target.checked ? 1 : 0 })}
                                    />
                                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 flex gap-3 justify-end">
                            <button
                                onClick={() => setEditingClass(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSubmitting || !editForm.name.trim()}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="クラスの削除"
                message={`クラス「${deleteConfirm?.name}」を削除してもよろしいですか？この操作は取り消せません。`}
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirm(null)}
                isLoading={isDeleting}
                variant="danger"
            />
        </div>
    );
};

export default ClassesSettings;
