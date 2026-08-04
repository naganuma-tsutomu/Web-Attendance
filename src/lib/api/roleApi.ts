import { z } from 'zod';
import type { DynamicRole } from '../../types';
import { DynamicRoleSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getRoles = async (): Promise<DynamicRole[]> => {
    return apiFetch<DynamicRole[]>('/settings/roles', {}, z.array(DynamicRoleSchema));
};

export const createRole = async (name: string, targetHours: number | null = null, patternIds: string[] = [], weeklyHoursTarget: number | null = null): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/roles', {
        method: 'POST',
        body: JSON.stringify({ name, targetHours, patternIds, weeklyHoursTarget })
    });
    return id;
};

export const updateRole = async (roleId: string, data: { name?: string, targetHours?: number | null, weeklyHoursTarget?: number | null, patternIds?: string[] }): Promise<void> => {
    await apiFetch(`/settings/roles/${encodeURIComponent(roleId)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const deleteRole = async (id: string): Promise<void> => {
    await apiFetch(`/settings/roles/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const updateRolePatterns = async (roleId: string, patternIds: string[]): Promise<void> => {
    return updateRole(roleId, { patternIds });
};

export const updateRoleOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/settings/roles/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};
