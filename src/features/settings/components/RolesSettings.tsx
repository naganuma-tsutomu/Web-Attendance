import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { createRole, deleteRole, updateRole, updateRolePatterns, updateRoleOrder } from '../../../lib/api';
import { handleApiError } from '../../../lib/errorHandler';
import { QUERY_KEYS } from '../../../lib/hooks';
import type { DynamicRole, ShiftTimePattern } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import RoleEditModal from './RoleEditModal';
import RoleAddModal from './RoleAddModal';
import RolesList from './RolesList';
import {
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

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

    const activeRole = activeId ? roles.find(r => r.id === activeId) ?? null : null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

            <div className="flex justify-end">
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 dark:shadow-none sm:px-5 sm:py-2.5"
                >
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">スタッフ区分追加</span>
                    <span className="sm:hidden">追加</span>
                </button>
            </div>

            <RolesList
                roles={roles}
                loading={loading}
                sensors={sensors}
                activeRole={activeRole}
                activeId={activeId}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDelete={setDeleteConfirmId}
                onEdit={handleEditClick}
            />

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
