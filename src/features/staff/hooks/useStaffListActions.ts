import { useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { useDeleteStaff, useUpdateStaffOrder } from '../../../lib/hooks';
import { handleApiError } from '../../../lib/errorHandler';
import type { Staff } from '../../../types';

export const useStaffListActions = (staffs: Staff[]) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteStaff = useDeleteStaff();
    const updateOrder = useUpdateStaffOrder();

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteStaff.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            toast.success('スタッフを削除しました。');
        } catch (error) {
            handleApiError(error, '削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over || active.id === over.id) return;

        const oldIndex = staffs.findIndex(staff => staff.id === active.id);
        const newIndex = staffs.findIndex(staff => staff.id === over.id);
        const orders = arrayMove(staffs, oldIndex, newIndex)
            .map((staff, index) => ({ id: staff.id, order: index + 1 }));

        updateOrder.mutate(orders, {
            onError: (error) => handleApiError(error, '並び替えの保存に失敗しました'),
        });
    };

    return {
        activeStaff: activeId ? staffs.find(staff => staff.id === activeId) : null,
        cancelDelete: () => setDeleteTarget(null),
        confirmDelete,
        deleteTarget,
        handleDragEnd,
        handleDragStart,
        isDeleting,
        requestDelete: (id: string, name: string) => setDeleteTarget({ id, name }),
    };
};
