import { useState } from 'react';
import { Plus, Trash2, Loader2, CheckCircle, GripVertical } from 'lucide-react';
import { createRole, deleteRole, updateRole, updateRolePatterns, updateRoleOrder } from '../../../lib/api';
import type { DynamicRole, ShiftTimePattern } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';
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
    showMessage: (msg: string) => void;
}

const SortableRoleItem = ({ role, index, timePatterns, onDelete, onUpdateRoleHours, onTogglePattern, isOverlay = false }: {
    role: DynamicRole,
    index: number,
    timePatterns: ShiftTimePattern[],
    onDelete?: (id: string) => void,
    onUpdateRoleHours: (id: string, h: number | null) => void,
    onTogglePattern: (id: string, pid: string, cur: ShiftTimePattern[]) => void,
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
            className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row hover:shadow-md transition-shadow group ${isOverlay ? 'ring-2 ring-indigo-500 shadow-xl' : ''}`}
        >
            {/* 左側：優先順位とドラッグハンドル */}
            <div className="flex items-center px-4 py-4 sm:py-0 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none min-w-[100px] justify-center space-x-3 sm:space-x-0 sm:flex-col sm:space-y-2">
                {!isOverlay && (
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 transition-colors p-1">
                        <GripVertical className="w-5 h-5" />
                    </div>
                )}
                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">優先順位</span>
                    <div className="w-10 h-10 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white dark:border-slate-800">
                        {index + 1}
                    </div>
                </div>
            </div>

            {/* 中央：役職情報と設定 */}
            <div className="flex-1 p-5 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-800">
                                {role.name.charAt(0)}
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-base">{role.name}</h4>
                        </div>
                        {!isOverlay && (
                            <button
                                onClick={() => onDelete?.(role.id)}
                                className="sm:hidden text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between pl-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">月間労働時間</label>
                                <div className="flex items-center space-x-2 scale-75 origin-right">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={role.targetHours !== null}
                                            onChange={(e) => {
                                                const newHours = e.target.checked ? 160 : null;
                                                onUpdateRoleHours(role.id, newHours);
                                            }}
                                        />
                                        <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="number"
                                    value={role.targetHours ?? ''}
                                    disabled={role.targetHours === null}
                                    onChange={(e) => onUpdateRoleHours(role.id, parseInt(e.target.value) || 0)}
                                    placeholder="設定なし"
                                    className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold transition-all ${role.targetHours === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white'}`}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">利用可能なパターン</p>
                            <div className="flex flex-wrap gap-2">
                                {timePatterns.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">まずはパターンを作成してください</p>
                                ) : (
                                    timePatterns.map(p => {
                                        const isAssigned = role.patterns.some(rp => rp.id === p.id);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => onTogglePattern(role.id, p.id, role.patterns)}
                                                className={`px-3 py-1.2 rounded-lg text-[10px] font-bold transition-all border flex items-center space-x-1.5 ${isAssigned ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${isAssigned ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                <span>{p.name}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右側：削除ボタン（PCのみ） */}
                {!isOverlay && (
                    <div className="hidden sm:flex items-start">
                        <button
                            onClick={() => onDelete?.(role.id)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-all"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const RolesSettings = ({ roles, setRoles, timePatterns, loading, onUpdate, showMessage }: RolesSettingsProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const [newRole, setNewRole] = useState<{
        name: string;
        hoursTarget: number | null;
        patternIds: string[];
    }>({
        name: '',
        hoursTarget: null,
        patternIds: []
    });

    const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createRole(newRole.name, newRole.hoursTarget, newRole.patternIds);
            setNewRole({ name: '', hoursTarget: null, patternIds: [] });
            showMessage('役職を追加しました');
            onUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateRoleHours = async (roleId: string, hours: number | null) => {
        try {
            await updateRole(roleId, { targetHours: hours });
            showMessage('目標時間を更新しました');
            onUpdate();
        } catch (err) { console.error(err); }
    };

    const handleDeleteRole = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await deleteRole(deleteConfirmId);
            setDeleteConfirmId(null);
            onUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTogglePattern = async (roleId: string, patternId: string, currentPatterns: ShiftTimePattern[]) => {
        const isAssigned = currentPatterns.some(p => p.id === patternId);
        const newPatternIds = isAssigned
            ? currentPatterns.filter(p => p.id !== patternId).map(p => p.id)
            : [...currentPatterns.map(p => p.id), patternId];

        try {
            await updateRolePatterns(roleId, newPatternIds);
            onUpdate();
        } catch (err) { console.error(err); }
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
            showMessage('優先順位を更新しました');
        } catch (err) {
            console.error('Failed to update role order', err);
            showMessage('並び替えの保存に失敗しました');
            onUpdate();
        }
    };

    const activeRole = activeId ? roles.find(r => r.id === activeId) : null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* Role form */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-6 text-sm uppercase tracking-wide">役職の新規登録</h4>
                <form onSubmit={handleAddRole} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">役職名</label>
                            <input
                                type="text"
                                required
                                placeholder="例: 正社員, パート, リーダー..."
                                value={newRole.name}
                                onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-900 text-sm dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between pl-1">
                                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">月間労働時間 (目安)</label>
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
                                    className={`flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold ${newRole.hoursTarget === null ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white'}`}
                                />
                                <span className="text-xs text-slate-500 font-bold">時間</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">利用可能な時間パターン (初期設定)</label>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap gap-2">
                                {timePatterns.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic px-1">まずは勤務パターンを登録してください</p>
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
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
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

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center space-x-2 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            <span>{isSubmitting ? '登録中...' : '役職を登録する'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Role List */}
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
                        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                            {roles.map((role, index) => (
                                <SortableRoleItem
                                    key={role.id}
                                    role={role}
                                    index={index}
                                    timePatterns={timePatterns}
                                    onDelete={setDeleteConfirmId}
                                    onUpdateRoleHours={handleUpdateRoleHours}
                                    onTogglePattern={handleTogglePattern}
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
                                timePatterns={timePatterns}
                                onUpdateRoleHours={handleUpdateRoleHours}
                                onTogglePattern={handleTogglePattern}
                                isOverlay
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}
            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="役職の削除"
                message="この役職を削除しますか？スタッフの割り当ては自動では解除されませんが、今後新規に選択することはできなくなります。"
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
