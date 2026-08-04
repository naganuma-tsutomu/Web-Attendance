import { z } from 'zod';
import type { Staff } from '../../types';
import { StaffSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getStaffList = async (): Promise<Staff[]> => {
    return apiFetch<Staff[]>('/staffs', {}, z.array(StaffSchema));
};

const StaffNameListSchema = z.array(z.object({ id: z.string(), name: z.string() }));

export const getStaffNameList = async (): Promise<{ id: string; name: string }[]> => {
    return apiFetch('/staffs/list', {}, StaffNameListSchema);
};

export const createStaff = async (staffData: Omit<Staff, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/staffs', {
        method: 'POST',
        body: JSON.stringify(staffData),
    });
    return id;
};

export const updateStaff = async (staffId: string, staffData: Partial<Staff>): Promise<void> => {
    await apiFetch(`/staffs/${encodeURIComponent(staffId)}`, {
        method: 'PUT',
        body: JSON.stringify(staffData),
    });
};

export const deleteStaff = async (staffId: string): Promise<void> => {
    await apiFetch(`/staffs/${encodeURIComponent(staffId)}`, { method: 'DELETE' });
};

export const updateStaffOrder = async (orders: { id: string; order: number }[]): Promise<void> => {
    await apiFetch('/staffs/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders }),
    });
};
