import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Clock, Loader2, GripVertical, Check } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createTimePattern, deleteTimePattern, updateTimePattern, reorderTimePatterns } from '../../../lib/api';
import type { ShiftTimePattern } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';

interface TimePatternsSettingsProps {
    patterns: ShiftTimePattern[];
    loading: boolean;
    onUpdate: () => void;
    showMessage: (msg: string) => void;
}

const DAYS = [
    { key: 'mon', label: '月', fullLabel: '月曜日' },
    { key: 'tue', label: '火', fullLabel: '火曜日' },
    { key: 'wed', label: '水', fullLabel: '水曜日' },
    { key: 'thu', label: '木', fullLabel: '木曜日' },
    { key: 'fri', label: '金', fullLabel: '金曜日' },
    { key: 'sat', label: '土', fullLabel: '土曜日' },
    { key: 'sun', label: '日', fullLabel: '日曜日' },
];

interface SortableItemProps {
    id: string;
    pattern: ShiftTimePattern;
    onEdit: (pattern: ShiftTimePattern) => void;
    onDelete: (id: string) => void;
}

const SortableItem = ({ id, pattern, onEdit, onDelete }: SortableItemProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    // Parse applicable_days from JSON string if it's a string
    const applicableDays = typeof pattern.applicable_days === 'string' 
        ? JSON.parse(pattern.applicable_days) 
        : pattern.applicable_days;

    const getDayLabels = () => {
        if (!applicableDays || applicableDays.length === 0) return '毎日';
        const labels = applicableDays.map((d: string) => DAYS.find(day => day.key === d)?.label).filter(Boolean);
        return labels.length === 0 ? '毎日' : labels.join(', ');
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group ${isDragging ? 'bg-indigo-50 dark:bg-indigo-900/20 shadow-lg ring-2 ring-indigo-500' : ''}`}
        >
            <div className="flex items-center space-x-3">
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                    title="ドラッグして並べ替え"
                >
                    <GripVertical className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                    {pattern.name.charAt(0)}
                </div>
                <div>
                    <div className="flex items-center space-x-2">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{pattern.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{pattern.startTime} 〜 {pattern.endTime}</span>
                    </p>
                    {applicableDays && applicableDays.length > 0 && (
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5 flex items-center space-x-1">
                            <span className="bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded">適用: {getDayLabels()}</span>
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center space-x-1">
                <button
                    onClick={() => onEdit(pattern)}
                    className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                    title="編集"
                >
                    <Edit2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(pattern.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title="削除"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const TimePatternsSettings = ({ patterns, loading, onUpdate, showMessage }: TimePatternsSettingsProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [localPatterns, setLocalPatterns] = useState<ShiftTimePattern[]>(patterns);
    const [formData, setFormData] = useState({ 
        name: '', 
        startTime: '09:00', 
        endTime: '18:00',
        applicable_days: [] as string[]
    });

    // Update local patterns when props change
    useState(() => {
        setLocalPatterns(patterns);
    });

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

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = localPatterns.findIndex(p => p.id === active.id);
            const newIndex = localPatterns.findIndex(p => p.id === over.id);
            
            const newPatterns = arrayMove(localPatterns, oldIndex, newIndex);
            setLocalPatterns(newPatterns);

            // Update display_order for all patterns
            const order = newPatterns.map((p, index) => ({
                id: p.id,
                display_order: index + 1
            }));

            try {
                await reorderTimePatterns(order);
                showMessage('並べ替えました');
                onUpdate();
            } catch (err) {
                console.error('Failed to reorder patterns', err);
                setLocalPatterns(patterns); // Revert on error
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = {
                name: formData.name,
                startTime: formData.startTime,
                endTime: formData.endTime,
                applicable_days: formData.applicable_days.length > 0 ? formData.applicable_days : null
            };

            if (editingId) {
                await updateTimePattern(editingId, dataToSave);
                showMessage('パターンを更新しました');
            } else {
                await createTimePattern(dataToSave);
                showMessage('パターンを追加しました');
            }
            cancelEdit();
            onUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (pattern: ShiftTimePattern) => {
        setEditingId(pattern.id);
        
        // Parse applicable_days if it's a string
        const applicableDays = typeof pattern.applicable_days === 'string'
            ? JSON.parse(pattern.applicable_days)
            : pattern.applicable_days || [];
        
        setFormData({
            name: pattern.name,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            applicable_days: applicableDays
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({ name: '', startTime: '09:00', endTime: '18:00', applicable_days: [] });
    };

    const handleDeletePattern = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await deleteTimePattern(deleteConfirmId);
            setDeleteConfirmId(null);
            showMessage('パターンを削除しました');
            onUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleDay = (dayKey: string) => {
        setFormData(prev => {
            const days = prev.applicable_days.includes(dayKey)
                ? prev.applicable_days.filter(d => d !== dayKey)
                : [...prev.applicable_days, dayKey];
            return { ...prev, applicable_days: days };
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Pattern form */}
            <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border ${editingId ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700'} shadow-sm transition-all`}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">
                        {editingId ? 'パターンの編集' : '新規作成'}
                    </h4>
                    {editingId && (
                        <button
                            onClick={cancelEdit}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center space-x-1"
                        >
                            <X className="w-3 h-3" />
                            <span>キャンセル</span>
                        </button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">パターン名 (必須)</label>
                            <input
                                type="text"
                                required
                                placeholder="例: 早番, 遅番, Aシフト..."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">開始時間</label>
                            <input
                                type="time"
                                required
                                value={formData.startTime}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">終了時間</label>
                            <input
                                type="time"
                                required
                                value={formData.endTime}
                                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white"
                            />
                        </div>
                    </div>

                    {/* Day of week selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">適用曜日（空白の場合は毎日）</label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map(day => {
                                const isSelected = formData.applicable_days.includes(day.key);
                                return (
                                    <button
                                        key={day.key}
                                        type="button"
                                        onClick={() => toggleDay(day.key)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-1.5 ${
                                            isSelected
                                                ? 'bg-indigo-500 text-white shadow-sm'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                        }`}
                                    >
                                        {isSelected && <Check className="w-3 h-3" />}
                                        <span>{day.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-400">
                            {formData.applicable_days.length === 0 
                                ? '全ての曜日に適用されます' 
                                : `${formData.applicable_days.map(d => DAYS.find(day => day.key === d)?.fullLabel).join('・')}に適用`}
                        </p>
                    </div>

                    <button
                        disabled={isSubmitting}
                        className={`${editingId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all h-[38px] flex items-center justify-center space-x-2 w-full sm:w-auto disabled:opacity-50`}
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                        <span>{isSubmitting ? (editingId ? '更新中...' : '追加中...') : (editingId ? '更新' : '追加')}</span>
                    </button>
                </form>
            </div>

            {/* Patterns list with drag & drop */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">登録済みパターン</h4>
                    <span className="text-xs font-medium text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">{localPatterns.length}件</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : localPatterns.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">パターンが登録されていません。</div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={localPatterns.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {localPatterns.map(p => (
                                    <SortableItem
                                        key={p.id}
                                        id={p.id}
                                        pattern={p}
                                        onEdit={handleEditClick}
                                        onDelete={setDeleteConfirmId}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="パターンの削除"
                message="この勤務時間パターンを削除しますか？"
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                onConfirm={handleDeletePattern}
                onCancel={() => setDeleteConfirmId(null)}
                isLoading={isDeleting}
                variant="danger"
            />
        </div>
    );
};

export default TimePatternsSettings;
