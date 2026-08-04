import { z } from 'zod';
import type { Shift } from '../../types';
import { ShiftSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getShiftsByMonth = async (yearMonth: string): Promise<Shift[]> => {
    return apiFetch<Shift[]>(`/shifts?yearMonth=${yearMonth}`, {}, z.array(ShiftSchema));
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify(shifts)
    });
};

export const replaceShiftsForMonth = async (yearMonth: string, shifts: Omit<Shift, 'id'>[], fixedDates: string[] = []): Promise<void> => {
    await apiFetch('/shifts/replace', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, shifts, fixedDates })
    });
};

export const deleteShiftsByMonth = async (
    yearMonth: string,
    exceptDates: string[] = [],
    clearFixedDates = false
): Promise<void> => {
    await apiFetch('/shifts/clear', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, exceptDates, clearFixedDates })
    });
};

export const updateShift = async (id: string, shiftData: Partial<Shift>): Promise<void> => {
    await apiFetch(`/shifts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(shiftData)
    });
};

export const deleteShift = async (id: string): Promise<void> => {
    await apiFetch(`/shifts/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const deleteShiftsByDateRange = async (startDate: string, endDate: string): Promise<number> => {
    const result = await apiFetch<{ deletedCount: number }>('/shifts/range', {
        method: 'DELETE',
        body: JSON.stringify({ startDate, endDate }),
    }, z.object({ deletedCount: z.number().int().nonnegative() }));
    return result.deletedCount;
};
