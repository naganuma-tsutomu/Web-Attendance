import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Clock, Loader2, GripVertical, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { createTimePattern, deleteTimePattern, updateTimePattern, updateTimePatternOrder, getRoles } from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { useBusinessHours } from '../../../lib/hooks';
import type { ShiftTimePattern, DynamicRole } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import TimePatternEditModal from './TimePatternEditModal';
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

interface TimePatternsSettingsProps {
    patterns: ShiftTimePattern[];
    setPatterns: React.Dispatch<React.SetStateAction<ShiftTimePattern[]>>;
    loading: boolean;
    onUpdate: () => void;
}

const DAYS = [
    { key: 'sun', label: '日' },
    { key: 'mon', label: '月' },
    { key: 'tue', label: '火' },
    { key: 'wed', label: '水' },
    { key: 'thu', label: '木' },
    { key: 'fri', label: '金' },
    { key: 'sat', label: '土' },
    { key: 'holiday', label: '祝' },
];

const SortablePatternRow = ({ pattern, roles, onDelete, onEdit, isOverlay = false }: {
    pattern: ShiftTimePattern,
    roles: DynamicRole[],
    onDelete?: (id: string) => void,
    onEdit?: () => void,
    isOverlay?: boolean
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: pattern.id, disabled: isOverlay });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
    };

    const assignedRoles = roles.filter(r => pattern.roleIds?.includes(r.id));

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
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border border-indigo-100 dark:border-indigo-800 flex-shrink-0">
                    {pattern.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{pattern.name}</p>
                        <div className="flex space-x-0.5">
                            {DAYS.map(d => (
                                <span key={d.key} className={`text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${(pattern as any)[d.key] === 1 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'}`}>
                                    {d.label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{pattern.startTime} 〜 {pattern.endTime}</span>
                        </p>
                        {assignedRoles.length > 0 && (
                            <div className="flex items-center space-x-1 text-[10px] text-indigo-500 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md">
                                <UserCheck className="w-2.5 h-2.5" />
                                <span>{assignedRoles.length}スタッフ区分</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {!isOverlay && (
                <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                    <button
                        onClick={onEdit}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                        title="編集"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete?.(pattern.id)}
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

const TimePatternsSettings = ({ patterns, setPatterns, loading, onUpdate }: TimePatternsSettingsProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [roles, setRoles] = useState<DynamicRole[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    // 営業時間設定を取得
    const { data: businessHours } = useBusinessHours();
    const closedDays = businessHours?.closedDays || [];

    // 営業日（closedDays）に基づいて初期値を計算
    const getDefaultDayValues = () => ({
        sun: closedDays.includes(0) ? 0 : 1,
        mon: closedDays.includes(1) ? 0 : 1,
        tue: closedDays.includes(2) ? 0 : 1,
        wed: closedDays.includes(3) ? 0 : 1,
        thu: closedDays.includes(4) ? 0 : 1,
        fri: closedDays.includes(5) ? 0 : 1,
        sat: closedDays.includes(6) ? 0 : 1,
        holiday: closedDays.includes(7) ? 0 : 1
    });

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: '',
        startTime: '09:00',
        endTime: '18:00',
        roleIds: [] as string[],
        ...getDefaultDayValues()
    });

    const [formData, setFormData] = useState({
        name: '',
        startTime: '09:00',
        endTime: '18:00',
        roleIds: [] as string[],
        ...getDefaultDayValues()
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        getRoles().then(setRoles).catch(err => handleApiError(err, 'スタッフ区分の読み込みに失敗しました'));
    }, []);

    const handleOpenAddModal = () => {
        setFormData({
            name: '', startTime: '09:00', endTime: '18:00', roleIds: [],
            ...getDefaultDayValues()
        });
        setIsAddModalOpen(true);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createTimePattern(formData);
            toast.success('パターンを追加しました');
            setIsAddModalOpen(false);
            setFormData({
                name: '', startTime: '09:00', endTime: '18:00', roleIds: [],
                ...getDefaultDayValues()
            });
            onUpdate();
        } catch (err) {
            handleApiError(err, 'パターンの追加に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        setIsSubmitting(true);
        try {
            await updateTimePattern(editingId, editFormData);
            toast.success('パターンを更新しました');
            setIsEditModalOpen(false);
            onUpdate();
        } catch (err) {
            handleApiError(err, 'パターンの更新に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (p: ShiftTimePattern) => {
        setEditingId(p.id);
        setEditFormData({
            name: p.name,
            startTime: p.startTime,
            endTime: p.endTime,
            roleIds: p.roleIds || [],
            sun: p.sun, mon: p.mon, tue: p.tue, wed: p.wed, thu: p.thu, fri: p.fri, sat: p.sat, holiday: p.holiday
        });
        setIsEditModalOpen(true);
    };

    const handleDeletePattern = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await deleteTimePattern(deleteConfirmId);
            setDeleteConfirmId(null);
            toast.success('パターンを削除しました');
            onUpdate();
        } catch (err) {
            handleApiError(err, 'パターンの削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over || active.id === over.id) return;

        const oldIndex = patterns.findIndex(p => p.id === active.id);
        const newIndex = patterns.findIndex(p => p.id === over.id);

        const newPatterns = arrayMove(patterns, oldIndex, newIndex);
        setPatterns(newPatterns);

        try {
            await updateTimePatternOrder(newPatterns.map((p, i) => ({ id: p.id, order: i })));
        } catch (err) {
            handleApiError(err, '並び替えの保存に失敗しました');
            onUpdate();
        }
    };

    const activePattern = activeId ? patterns.find(p => p.id === activeId) : null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Add Pattern Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span>パターン追加</span>
                </button>
            </div>

            {/* Patterns list */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider flex items-center">
                        <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                        登録済みパターン
                    </h4>
                    <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm">
                        {patterns.length}
                    </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                            <p className="text-sm font-medium">ロード中...</p>
                        </div>
                    ) : patterns.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Clock className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-medium text-slate-400">パターンが登録されていません。</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            modifiers={[restrictToVerticalAxis]}
                        >
                            <SortableContext
                                items={patterns.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {patterns.map(p => (
                                    <div key={p.id}>
                                        <SortablePatternRow
                                            pattern={p}
                                            roles={roles}
                                            onEdit={() => handleEditClick(p)}
                                            onDelete={() => setDeleteConfirmId(p.id)}
                                        />
                                    </div>
                                ))}
                            </SortableContext>

                            <DragOverlay dropAnimation={{
                                sideEffects: defaultDropAnimationSideEffects({
                                    styles: { active: { opacity: '0.3' } },
                                }),
                            }}>
                                {activePattern ? (
                                    <div className="w-full">
                                        <SortablePatternRow
                                            pattern={activePattern}
                                            roles={roles}
                                            isOverlay
                                        />
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            <TimePatternEditModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleCreateSubmit}
                formData={formData}
                setFormData={setFormData}
                roles={roles}
                isSubmitting={isSubmitting}
                title="新しい勤務パターン"
            />

            {/* Edit Modal */}
            <TimePatternEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditSubmit}
                formData={editFormData}
                setFormData={setEditFormData}
                roles={roles}
                isSubmitting={isSubmitting}
            />

            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="パターンの削除"
                message="この勤務時間パターンを削除してもよろしいですか？この操作は取り消せません。"
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
