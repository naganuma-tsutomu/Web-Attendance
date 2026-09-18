import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useCreateStaff, useUpdateStaff } from '../../../lib/hooks';
import { handleApiError } from '../../../lib/errorHandler';
import type { BusinessHours, DynamicRole, Staff } from '../../../types';

const emptyStaff: Omit<Staff, 'id'> = {
    name: '',
    role: '',
    hoursTarget: null,
    weeklyHoursTarget: null,
    classIds: [],
};

export const useStaffForm = (roles: DynamicRole[], businessHours?: BusinessHours) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState<Omit<Staff, 'id'>>(emptyStaff);
    const createStaff = useCreateStaff();
    const updateStaff = useUpdateStaff();

    const openAddForm = () => {
        const defaultRole = roles[0];
        const closedDays = businessHours?.closedDays || [];
        setEditingStaff(null);
        setFormData({
            ...emptyStaff,
            role: defaultRole?.name || '',
            hoursTarget: defaultRole?.targetHours ?? null,
            weeklyHoursTarget: defaultRole?.weeklyHoursTarget ?? null,
            defaultWorkingHoursStart: null,
            defaultWorkingHoursEnd: null,
            availableDays: [1, 2, 3, 4, 5, 6].filter(day => !closedDays.includes(day)),
        });
        setIsOpen(true);
    };

    const openEditForm = (staff: Staff) => {
        setEditingStaff(staff);
        setFormData({
            name: staff.name,
            role: staff.role,
            hoursTarget: staff.hoursTarget ?? null,
            weeklyHoursTarget: staff.weeklyHoursTarget ?? null,
            availableDays: staff.availableDays || [1, 2, 3, 4, 5, 6],
            defaultWorkingHoursStart: staff.defaultWorkingHoursStart || null,
            defaultWorkingHoursEnd: staff.defaultWorkingHoursEnd || null,
            classIds: staff.classIds || [],
            accessKey: staff.accessKey || null,
        });
        setIsOpen(true);
    };

    const handleRoleChange = (roleName: string) => {
        const selectedRole = roles.find(role => role.name === roleName);
        setFormData(previous => ({
            ...previous,
            role: roleName,
            hoursTarget: selectedRole?.targetHours ?? previous.hoursTarget,
            weeklyHoursTarget: selectedRole?.weeklyHoursTarget ?? previous.weeklyHoursTarget,
        }));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            if (editingStaff) {
                await updateStaff.mutateAsync({ id: editingStaff.id, data: formData });
            } else {
                await createStaff.mutateAsync(formData);
            }
            setIsOpen(false);
            toast.success(editingStaff ? 'スタッフ情報を更新しました。' : 'スタッフを追加しました。');
        } catch (error) {
            handleApiError(error, '保存に失敗しました');
        }
    };

    return {
        closeForm: () => setIsOpen(false),
        editingStaff,
        formData,
        handleRoleChange,
        handleSubmit,
        isOpen,
        isSubmitting: createStaff.isPending || updateStaff.isPending,
        openAddForm,
        openEditForm,
        setFormData,
    };
};
