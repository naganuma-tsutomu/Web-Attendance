import { z } from 'zod';
import type { ShiftClass } from '../../types';
import { ShiftClassSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getClasses = async (): Promise<ShiftClass[]> => {
    return apiFetch<ShiftClass[]>('/settings/classes', {}, z.array(ShiftClassSchema));
};

export const createClass = async (name: string, autoAllocate: number = 1, color?: string): Promise<{ id: string }> => {
    return apiFetch<{ id: string }>('/settings/classes', {
        method: 'POST',
        body: JSON.stringify({ name, auto_allocate: autoAllocate, color })
    });
};

export const updateClass = async (id: string, data: { name?: string, display_order?: number, auto_allocate?: number, color?: string }): Promise<void> => {
    await apiFetch(`/settings/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const updateClassOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/settings/classes/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};

export const deleteClass = async (id: string): Promise<void> => {
    await apiFetch(`/settings/classes/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};
