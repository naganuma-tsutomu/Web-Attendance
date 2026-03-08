import { useState } from 'react';
import { Plus, Trash2, Users, Loader2, GripVertical, Edit2, Check, X } from 'lucide-react';
import { createClass, deleteClass, updateClass, updateClassOrder } from '../../../lib/api';
import type { ShiftClass } from '../../../types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
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

interface ClassesSettingsProps {
    classes: ShiftClass[];
    loading: boolean;
    onUpdate: () => void;
    // We need to pass a setter for optimistic UI updates during drag & drop
    setClasses: React.Dispatch<React.SetStateAction<ShiftClass[]>>;
    showMessage: (msg: string) => void;
}

const SortableClassRow = ({ cls, onDelete, onEdit, children }: {
    cls: ShiftClass,
    onDelete: (id: string) => void,
    onEdit: () => void,
    children: React.ReactNode
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: cls.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all ${isDragging ? 'bg-indigo-50/50 outline-2 outline-indigo-200 outline-dashed' : ''}`}
        >
            <div className="flex items-center space-x-4">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 p-1 rounded-lg hover:bg-white transition-all"
                >
                    <GripVertical className="w-5 h-5" />
                </button>
                {children}
            </div>
            <div className="flex items-center space-x-1">
                <button
                    onClick={onEdit}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                    title="編集"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(cls.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title="削除"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const ClassesSettings = ({ classes, loading, onUpdate, setClasses, showMessage }: ClassesSettingsProps) => {
    const [newClass, setNewClass] = useState({ name: '', auto_allocate: 1 });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClass.name.trim()) return;
        try {
            await createClass(newClass.name, newClass.auto_allocate);
            setNewClass({ name: '', auto_allocate: 1 });
            showMessage('クラスを追加しました');
            onUpdate();
        } catch (err) { console.error(err); }
    };

    const handleToggleClassAllocation = async (cls: ShiftClass) => {
        const newValue = cls.auto_allocate === 1 ? 0 : 1;
        try {
            await updateClass(cls.id, { auto_allocate: newValue });
            showMessage('設定を更新しました');
            onUpdate();
        } catch (err) { console.error(err); }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm('このクラスを削除しますか？')) return;
        try {
            await deleteClass(id);
            onUpdate();
        } catch (err) { console.error(err); }
    };

    const handleStartEdit = (cls: ShiftClass) => {
        setEditingId(cls.id);
        setEditName(cls.name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await updateClass(id, { name: editName });
            setEditingId(null);
            showMessage('クラス名を更新しました');
            onUpdate();
        } catch (err) { console.error(err); }
    };

    const handleClassDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
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
            // Rollback on error
            onUpdate();
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center space-x-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <span>クラス（グループ）管理</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    スタッフが所属するクラスやグループを管理します。ドラッグ＆ドロップで表示順を並び替えられます。
                </p>
            </div>

            {/* Class form */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 text-sm uppercase tracking-wide">クラスの新規作成</h4>
                <form onSubmit={handleAddClass} className="space-y-4">
                    <div className="flex gap-4 items-end">
                        <div className="space-y-1 flex-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">クラス名 (必須)</label>
                            <input
                                type="text"
                                required
                                placeholder="例: ひまわり組, 事務, キッチン..."
                                value={newClass.name}
                                onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                            />
                        </div>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2">
                            <Plus className="w-4 h-4" />
                            <span>追加</span>
                        </button>
                    </div>
                    <div className="flex items-center space-x-2 pl-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={newClass.auto_allocate === 1}
                                onChange={(e) => setNewClass({ ...newClass, auto_allocate: e.target.checked ? 1 : 0 })}
                            />
                            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">このクラスを自動シフト作成の対象にする</span>
                    </div>
                </form>
            </div>

            {/* Classes list */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">登録済みクラス</h4>
                    <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{classes.length}件</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : classes.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">クラスが登録されていません。</div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
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
                                        onDelete={handleDeleteClass}
                                        onEdit={() => handleStartEdit(c)}
                                    >
                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold">
                                            {c.name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            {editingId === c.id ? (
                                                <div className="flex items-center space-x-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="px-2 py-1 border border-indigo-300 dark:border-indigo-600 rounded bg-white dark:bg-slate-900 text-sm focus:ring-1 focus:ring-indigo-500 outline-none w-full max-w-[200px]"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEdit(c.id);
                                                            if (e.key === 'Escape') handleCancelEdit();
                                                        }}
                                                    />
                                                    <button onClick={() => handleSaveEdit(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleCancelEdit} className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="font-bold text-slate-800 dark:text-slate-100">{c.name}</p>
                                            )}
                                            <div className="flex items-center space-x-2 mt-1">
                                                <label className="relative inline-flex items-center cursor-pointer scale-75 origin-left">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={c.auto_allocate === 1}
                                                        onChange={() => handleToggleClassAllocation(c)}
                                                    />
                                                    <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">自動割り当て: {c.auto_allocate === 1 ? '有効' : '無効'}</span>
                                            </div>
                                        </div>
                                    </SortableClassRow>
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassesSettings;
