import { z } from 'zod';
import type { Staff } from '../../types';
import { StaffSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getStaffList = async (): Promise<Staff[]> => {
    return apiFetch<Staff[]>('/staffs', {}, z.array(StaffSchema));
};

const StaffNameListSchema = z.array(z.object({ id: z.string(), name: z.string() }));

const normalizeStaffWriteData = (staffData: Partial<Staff>) => ({
    ...(staffData.name !== undefined ? { name: staffData.name } : {}),
    ...(staffData.role !== undefined ? { role: staffData.role } : {}),
    ...(staffData.hoursTarget !== undefined ? { hoursTarget: staffData.hoursTarget } : {}),
    ...(staffData.weeklyHoursTarget !== undefined ? { weeklyHoursTarget: staffData.weeklyHoursTarget } : {}),
    ...(staffData.defaultWorkingHoursStart !== undefined
        ? { defaultWorkingHoursStart: staffData.defaultWorkingHoursStart === '' ? null : staffData.defaultWorkingHoursStart }
        : {}),
    ...(staffData.defaultWorkingHoursEnd !== undefined
        ? { defaultWorkingHoursEnd: staffData.defaultWorkingHoursEnd === '' ? null : staffData.defaultWorkingHoursEnd }
        : {}),
    ...(staffData.accessKey !== undefined
        ? { accessKey: staffData.accessKey === '' ? null : staffData.accessKey }
        : {}),
    ...(staffData.availableDays !== undefined ? { availableDays: staffData.availableDays } : {}),
    ...(staffData.classIds !== undefined ? { classIds: staffData.classIds } : {}),
});

export const getStaffNameList = async (): Promise<{ id: string; name: string }[]> => {
    return apiFetch('/staffs/list', {}, StaffNameListSchema);
};

export const createStaff = async (staffData: Omit<Staff, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/staffs', {
        method: 'POST',
        body: JSON.stringify(normalizeStaffWriteData(staffData)),
    });
    return id;
};

export const updateStaff = async (staffId: string, staffData: Partial<Staff>): Promise<void> => {
    await apiFetch(`/staffs/${encodeURIComponent(staffId)}`, {
        method: 'PUT',
        body: JSON.stringify(normalizeStaffWriteData(staffData)),
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
