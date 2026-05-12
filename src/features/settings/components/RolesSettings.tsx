import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createRole, deleteRole, updateRole, updateRolePatterns, updateRoleOrder } from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { QUERY_KEYS } from '../../../lib/hooks';
import type { DynamicRole, ShiftTimePattern } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import RoleEditModal from './RoleEditModal';
import RoleAddModal from './RoleAddModal';
import SortableRoleItem from './SortableRoleItem';
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
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface RolesSettingsProps {
    roles: DynamicRole[];
    setRoles: React.Dispatch<React.SetStateAction<DynamicRole[]>>;
    timePatterns: ShiftTimePattern[];
    loading: boolean;
    onUpdate: () => void;
}

const RolesSettings = ({ roles, setRoles, timePatterns, loading, onUpdate }: RolesSettingsProps) => {
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

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
            const currentIndex = roles.findIndex(r => r.id === editingId);
            const newIndex = Math.max(0, Math.min(roles.length - 1, editFormData.order - 1));

            if (currentIndex !== newIndex) {
                const newRoles = arrayMove(roles, currentIndex, newIndex);
                const orders = newRoles.map((r, idx) => ({ id: r.id, order: idx + 1 }));
                await updateRoleOrder(orders);
                setRoles(newRoles);
            }

            await updateRole(editingId, {
                name: editFormData.name,
                targetHours: editFormData.hoursTarget,
                weeklyHoursTarget: editFormData.weeklyHoursTarget
            });
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
            const orders = newRoles.map((r, index) => ({ id: r.id, order: index + 1 }));
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

            <div className="flex justify-end">
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all font-bold"
                >
                    <Plus className="w-5 h-5" />
                    <span>スタッフ区分追加</span>
                </button>
            </div>

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
                        <SortableContext items={roles.map(r => r.id)} strategy={verticalListSortingStrategy}>
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
                                styles: { active: { opacity: '0.3' } }
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

            <RoleAddModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleAddRole}
                newRole={newRole}
                setNewRole={setNewRole}
                timePatterns={timePatterns}
                isSubmitting={isSubmitting}
            />

            <RoleEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditSubmit}
                formData={editFormData}
                setFormData={setEditFormData}
                timePatterns={timePatterns}
                isSubmitting={isSubmitting}
            />

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
