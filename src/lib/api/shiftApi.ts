import { z } from 'zod';
import type { Shift } from '../../types';
import { ShiftSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export type ShiftMonthData = { shifts: Shift[]; version: number };
type ReplaceShiftInput = Omit<Shift, 'id'> & { id?: string };

const ShiftMonthDataSchema = z.object({
    shifts: z.array(ShiftSchema),
    version: z.number().int().nonnegative(),
});

export const getShiftsByMonth = async (yearMonth: string): Promise<ShiftMonthData> => {
    return apiFetch<ShiftMonthData>(`/shifts?yearMonth=${yearMonth}`, {}, ShiftMonthDataSchema);
};

export const saveShiftsBatch = async (shifts: Omit<Shift, 'id'>[]): Promise<void> => {
    await apiFetch('/shifts', {
        method: 'POST',
        body: JSON.stringify(shifts)
    });
};

export const replaceShiftsForMonth = async (yearMonth: string, expectedVersion: number, shifts: ReplaceShiftInput[], fixedDates: string[] = []): Promise<void> => {
    const shiftsForRequest = shifts.map(shift => ({
        date: shift.date,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        classType: shift.classType,
        ...(shift.isEarlyShift !== undefined ? { isEarlyShift: shift.isEarlyShift } : {}),
        ...(shift.isError !== undefined ? { isError: shift.isError } : {}),
        ...(shift.duty_number !== undefined ? { duty_number: shift.duty_number } : {}),
    }));
    await apiFetch('/shifts/replace', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, expectedVersion, shifts: shiftsForRequest, fixedDates })
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
