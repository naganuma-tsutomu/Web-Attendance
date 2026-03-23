import { useState } from 'react';
import { Plus, Trash2, Users, Loader2, GripVertical, Edit2, Check, X, UserCheck } from 'lucide-react';
import { createClass, deleteClass, updateClass, updateClassOrder } from '../../../lib/api';

const CLASS_COLORS = [
    '#818cf8', '#60a5fa', '#34d399', '#fbbf24',
    '#f87171', '#c084fc', '#fb923c', '#f472b6',
    '#2dd4bf', '#94a3b8',
];

const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
        {CLASS_COLORS.map(c => (
            <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={`w-6 h-6 rounded-full transition-all ${value === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
                title={c}
            />
        ))}
    </div>
);
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

interface ClassesSettingsProps {
    classes: ShiftClass[];
    staffs: Staff[];
    loading: boolean;
    onUpdate: () => void;
    // We need to pass a setter for optimistic UI updates during drag & drop
    setClasses: React.Dispatch<React.SetStateAction<ShiftClass[]>>;
    showMessage: (msg: string) => void;
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
        <div className={`flex items-center space-x-4 flex-1`}>
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

const ClassesSettings = ({ classes, staffs, loading, onUpdate, setClasses, showMessage }: ClassesSettingsProps) => {
    const [newClass, setNewClass] = useState({ name: '', auto_allocate: 1, color: CLASS_COLORS[0] });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState(CLASS_COLORS[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClass.name.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await createClass(newClass.name, newClass.auto_allocate, newClass.color);
            setNewClass({ name: '', auto_allocate: 1, color: CLASS_COLORS[0] });
            showMessage(`クラス「${newClass.name}」を追加しました`);
            onUpdate();
        } catch (err) {
            console.error(err);
            showMessage('エラー：クラスの追加に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleClassAllocation = async (cls: ShiftClass) => {
        const newValue = cls.auto_allocate === 1 ? 0 : 1;
        try {
            await updateClass(cls.id, { auto_allocate: newValue });
            showMessage(`設定を${newValue === 1 ? '有効' : '無効'}に更新しました`);
            onUpdate();
        } catch (err) {
            console.error(err);
            showMessage('設定の更新に失敗しました');
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
            showMessage(`クラス「${deleteConfirm.name}」を削除しました`);
            setDeleteConfirm(null);
            onUpdate();
        } catch (err) {
            console.error(err);
            showMessage('エラー：削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleStartEdit = (cls: ShiftClass) => {
        setEditingId(cls.id);
        setEditName(cls.name);
        setEditColor(cls.color || CLASS_COLORS[0]);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await updateClass(id, { name: editName, color: editColor });
            setEditingId(null);
            showMessage('クラス名を更新しました');
            onUpdate();
        } catch (err) {
            console.error(err);
            showMessage('エラー：更新に失敗しました');
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
            const orders = newClasses.map((c, index) => ({
                id: c.id,
                order: index
            }));
            await updateClassOrder(orders);
        } catch (err) {
            console.error('Failed to update class order', err);
            showMessage('並び替えの保存に失敗しました');
            onUpdate();
        }
    };

    const activeClass = activeId ? classes.find(c => c.id === activeId) : null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Class form */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-slate-200/50">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-5 text-sm uppercase tracking-wider flex items-center">
                    <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                    クラスの新規作成
                </h4>
                <form onSubmit={handleAddClass} className="space-y-5">
                    <div className="space-y-3">
                        <div className="flex gap-4 items-end">
                            <div className="space-y-1.5 flex-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">クラス名</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例: ひまわり組, 事務, キッチン..."
                                    value={newClass.name}
                                    onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white transition-all outline-none"
                                />
                            </div>
                            <button
                                disabled={isSubmitting || !newClass.name.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all h-[44px] flex items-center justify-center space-x-2 min-w-[100px]"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        <span>追加</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">クラスカラー</label>
                            <ColorPicker value={newClass.color} onChange={c => setNewClass({ ...newClass, color: c })} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 pl-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={newClass.auto_allocate === 1}
                                onChange={(e) => setNewClass({ ...newClass, auto_allocate: e.target.checked ? 1 : 0 })}
                            />
                            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">このクラスを自動シフト作成の対象にする</span>
                    </div>
                </form>
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
                                    <div key={c.id}>
                                        {editingId === c.id ? (
                                            <div className="px-6 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 space-y-3">
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="w-full px-3 py-2 border-2 border-indigo-300 dark:border-indigo-600 rounded-xl bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveEdit(c.id);
                                                                if (e.key === 'Escape') handleCancelEdit();
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={() => handleSaveEdit(c.id)}
                                                            disabled={isSubmitting || !editName.trim()}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl transition-all disabled:opacity-50"
                                                        >
                                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                                                        </button>
                                                        <button onClick={handleCancelEdit} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <ColorPicker value={editColor} onChange={setEditColor} />
                                            </div>
                                        ) : (
                                            <div className="group relative">
                                                <SortableClassRow
                                                    cls={c}
                                                    staffCount={staffs.filter(s => s.classIds?.includes(c.id)).length}
                                                    onDelete={() => handleDeleteClick(c)}
                                                    onEdit={() => handleStartEdit(c)}
                                                    onToggleAllocation={() => handleToggleClassAllocation(c)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </SortableContext>

                            <DragOverlay dropAnimation={{
                                sideEffects: defaultDropAnimationSideEffects({
                                    styles: {
                                        active: {
                                            opacity: '0.3',
                                        },
                                    },
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

            {/* Confirm Modal */}
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
