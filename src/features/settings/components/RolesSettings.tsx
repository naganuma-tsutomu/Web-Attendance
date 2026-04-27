import { useState } from 'react';
import { Plus, Trash2, Loader2, CheckCircle, GripVertical, Edit2, X, Target, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createRole, deleteRole, updateRole, updateRolePatterns, updateRoleOrder } from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { QUERY_KEYS } from '../../../lib/hooks';
import type { DynamicRole, ShiftTimePattern } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import RoleEditModal from './RoleEditModal';
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

interface RolesSettingsProps {
    roles: DynamicRole[];
    setRoles: React.Dispatch<React.SetStateAction<DynamicRole[]>>;
    timePatterns: ShiftTimePattern[];
    loading: boolean;
    onUpdate: () => void;
}

const SortableRoleItem = ({ role, index, onDelete, onEdit, isOverlay = false }: {
    role: DynamicRole,
    index: number,
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
                    <div className="flex items-center gap-1 flex-shrink-0">
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

const RolesSettings = ({ roles, setRoles, timePatterns, loading, onUpdate }: RolesSettingsProps) => {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: '',
        hoursTarget: null as number | null,
        weeklyHoursTarget: null as number | null,
        patternIds: [] as string[],
        order: 1
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const [newRole, setNewRole] = useState<{
        name: string;
        hoursTarget: number | null;
        weeklyHoursTarget: number | null;
        patternIds: string[];
    }>({
        name: '',
        hoursTarget: null,
        weeklyHoursTarget: null,
        patternIds: []
    });

    const handleOpenAddModal = () => {
        setNewRole({ name: '', hoursTarget: null, weeklyHoursTarget: null, patternIds: [] });
        setIsAddModalOpen(true);
    };

    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createRole(newRole.name, newRole.hoursTarget, newRole.patternIds, newRole.weeklyHoursTarget);
            setNewRole({ name: '', hoursTarget: null, weeklyHoursTarget: null, patternIds: [] });
            toast.success('スタッフ区分を追加しました');
            setIsAddModalOpen(false);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.roles });
            onUpdate();
        } catch (err) {
            handleApiError(err, 'スタッフ区分の追加に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (role: DynamicRole) => {
        const index = roles.findIndex(r => r.id === role.id);
        setEditingId(role.id);
        setEditFormData({
            name: role.name,
            hoursTarget: role.targetHours,
            weeklyHoursTarget: role.weeklyHoursTarget ?? null,
            patternIds: role.patterns.map(p => p.id),
            order: index + 1
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        setIsSubmitting(true);
        try {
            // Check if order changed
            const currentIndex = roles.findIndex(r => r.id === editingId);
            const newIndex = Math.max(0, Math.min(roles.length - 1, editFormData.order - 1));

            if (currentIndex !== newIndex) {
                const newRoles = arrayMove(roles, currentIndex, newIndex);
                const orders = newRoles.map((r, idx) => ({
                    id: r.id,
                    order: idx + 1
                }));
                await updateRoleOrder(orders);
                setRoles(newRoles);
            }

            // Update basic info
            await updateRole(editingId, {
                name: editFormData.name,
                targetHours: editFormData.hoursTarget,
                weeklyHoursTarget: editFormData.weeklyHoursTarget
            });
            // Update patterns
            await updateRolePatterns(editingId, editFormData.patternIds);

            toast.success('スタッフ区分を更新しました');
            setIsEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.roles });
            onUpdate();
        } catch (err) {
            handleApiError(err, 'スタッフ区分の更新に失敗しました');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await deleteRole(deleteConfirmId);
            setDeleteConfirmId(null);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.roles });
            onUpdate();
        } catch (err) {
            handleApiError(err, 'スタッフ区分の削除に失敗しました');
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

        const oldIndex = roles.findIndex(r => r.id === active.id);
        const newIndex = roles.findIndex(r => r.id === over.id);

        const newRoles = arrayMove(roles, oldIndex, newIndex);
        setRoles(newRoles);

        try {
            const orders = newRoles.map((r, index) => ({
                id: r.id,
                order: index + 1
            }));
            await updateRoleOrder(orders);
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.roles });
        } catch (err) {
            handleApiError(err, '並び替えの保存に失敗しました');
            onUpdate();
        }
    };

    const activeRole = activeId ? roles.find(r => r.id === activeId) : null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Add Role Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span>スタッフ区分追加</span>
                </button>
            </div>

            {/* Role List */}
            <div className="space-y-4 max-w-4xl mx-auto w-full">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-4 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider flex items-center">
                        <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                        登録済みスタッフ区分
                    </h4>
                    <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full shadow-sm">
                        {roles.length}
                    </span>
                </div>

                {loading ? (
                    <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <SortableContext
                            items={roles.map(r => r.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-col gap-4">
                                {roles.map((role, index) => (
                                    <SortableRoleItem
                                        key={role.id}
                                        role={role}
                                        index={index}
                                        onDelete={setDeleteConfirmId}
                                        onEdit={() => handleEditClick(role)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                        <DragOverlay dropAnimation={{
                            sideEffects: defaultDropAnimationSideEffects({
                                styles: {
                                    active: { opacity: '0.3' }
                                }
                            })
                        }}>
                            {activeRole ? (
                                <SortableRoleItem
                                    role={activeRole}
                                    index={roles.findIndex(r => r.id === activeId)}
                                    isOverlay
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                        <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/30">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                                <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                                新しいスタッフ区分
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="bg-white dark:bg-slate-700 p-2 rounded-full shadow-sm hover:shadow-md transition-all text-slate-400 dark:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddRole} className="p-8 space-y-8 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                            スタッフ区分名 <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="例: 正社員, パート, リーダー..."
                                            value={newRole.name}
                                            onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                            className="w-full px-5 py-3.5 border border-slate-100 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-white outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between ml-1">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
                                                <Target className="w-3.5 h-3.5 mr-2" />
                                                月間労働時間 (目安)
                                            </label>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-bold text-slate-500">{newRole.hoursTarget === null ? '制限なし' : '設定する'}</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={newRole.hoursTarget !== null}
                                                        onChange={(e) => {
                                                            setNewRole({ ...newRole, hoursTarget: e.target.checked ? 160 : null });
                                                        }}
                                                    />
                                                    <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                value={newRole.hoursTarget === null ? '' : newRole.hoursTarget}
                                                disabled={newRole.hoursTarget === null}
                                                onChange={e => setNewRole({ ...newRole, hoursTarget: parseInt(e.target.value) || 0 })}
                                                placeholder="設定なし"
                                                className={`flex-1 px-5 py-3.5 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold ${newRole.hoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                            />
                                            <span className="text-xs text-slate-500 font-bold">時間</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between ml-1">
                                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center">
                                                <Calendar className="w-3.5 h-3.5 mr-2" />
                                                週間労働時間 (目安)
                                            </label>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-bold text-slate-500">{newRole.weeklyHoursTarget === null ? '制限なし' : '設定する'}</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={newRole.weeklyHoursTarget !== null}
                                                        onChange={(e) => {
                                                            setNewRole({ ...newRole, weeklyHoursTarget: e.target.checked ? 40 : null });
                                                        }}
                                                    />
                                                    <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                value={newRole.weeklyHoursTarget === null ? '' : newRole.weeklyHoursTarget}
                                                disabled={newRole.weeklyHoursTarget === null}
                                                onChange={e => setNewRole({ ...newRole, weeklyHoursTarget: parseInt(e.target.value) || 0 })}
                                                placeholder="設定なし"
                                                className={`flex-1 px-5 py-3.5 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold ${newRole.weeklyHoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white'}`}
                                            />
                                            <span className="text-xs text-slate-500 font-bold">時間</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                                            利用可能な時間パターン
                                        </label>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 min-h-[200px]">
                                            <div className="flex flex-wrap gap-2">
                                                {timePatterns.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic">まずは勤務パターンを登録してください</p>
                                                ) : (
                                                    timePatterns.map(p => {
                                                        const isSelected = newRole.patternIds.includes(p.id);
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const nextIds = isSelected
                                                                        ? newRole.patternIds.filter(id => id !== p.id)
                                                                        : [...newRole.patternIds, p.id];
                                                                    setNewRole({ ...newRole, patternIds: nextIds });
                                                                }}
                                                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                                            >
                                                                {isSelected && <CheckCircle className="w-3 h-3" />}
                                                                <span>{p.name}</span>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 min-w-0 px-4 py-4 border border-slate-100 dark:border-slate-700 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] min-w-0 px-4 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 dark:shadow-none transition-all font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                                            <span>登録中...</span>
                                        </>
                                    ) : (
                                        <span>スタッフ区分を登録</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            <RoleEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditSubmit}
                formData={editFormData}
                setFormData={setEditFormData}
                timePatterns={timePatterns}
                isSubmitting={isSubmitting}
            />

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="スタッフ区分の削除"
                message="このスタッフ区分を削除しますか？スタッフの割り当ては自動では解除されませんが、今後新規に選択することはできなくなります。"
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                onConfirm={handleDeleteRole}
                onCancel={() => setDeleteConfirmId(null)}
                isLoading={isDeleting}
                variant="danger"
            />
        </div>
    );
};

export default RolesSettings;
