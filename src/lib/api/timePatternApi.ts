import { z } from 'zod';
import type { ShiftTimePattern } from '../../types';
import { ShiftTimePatternSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getTimePatterns = async (): Promise<ShiftTimePattern[]> => {
    return apiFetch<ShiftTimePattern[]>('/settings/time-patterns', {}, z.array(ShiftTimePatternSchema));
};

export const createTimePattern = async (pattern: Omit<ShiftTimePattern, 'id'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/time-patterns', {
        method: 'POST',
        body: JSON.stringify(pattern)
    });
    return id;
};

export const deleteTimePattern = async (id: string): Promise<void> => {
    await apiFetch(`/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const updateTimePattern = async (id: string, pattern: Partial<ShiftTimePattern>): Promise<void> => {
    await apiFetch(`/settings/time-patterns/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(pattern)
    });
};

export const updateTimePatternOrder = async (orders: { id: string, order: number }[]): Promise<void> => {
    await apiFetch('/settings/time-patterns/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orders })
    });
};
