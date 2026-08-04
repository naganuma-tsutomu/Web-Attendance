import { z } from 'zod';
import type { Holiday } from '../../types';
import { HolidaySchema } from '../../types/schemas';
import { getLastHolidaySyncDate, setLastHolidaySyncDate } from '../../utils/dateUtils';
import { apiFetch } from '../apiClient';

export const getHolidays = async (year?: number): Promise<Holiday[]> => {
    const url = year ? `/settings/holidays?year=${year}` : '/settings/holidays';
    return apiFetch<Holiday[]>(url, {}, z.array(HolidaySchema));
};

export const createHoliday = async (holiday: Omit<Holiday, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    const { id } = await apiFetch<{ id: string }>('/settings/holidays', {
        method: 'POST',
        body: JSON.stringify(holiday)
    });
    return id;
};

export const updateHoliday = async (id: string, data: Partial<Holiday>): Promise<void> => {
    await apiFetch(`/settings/holidays/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const deleteHoliday = async (id: string): Promise<void> => {
    await apiFetch(`/settings/holidays/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

const SyncHolidaysResultSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    synced: z.number(),
    skipped: z.number(),
});

export const syncHolidays = async (year?: number): Promise<{ success: boolean; message: string; synced: number; skipped: number }> => {
    const url = year ? `/settings/holidays/sync?year=${year}` : '/settings/holidays/sync';
    return apiFetch(url, {}, SyncHolidaysResultSchema);
};

export const syncHolidaysIfNeeded = async (): Promise<void> => {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastSyncStr = getLastHolidaySyncDate();
        if (lastSyncStr === todayStr) return;
        await syncHolidays();
        setLastHolidaySyncDate(todayStr);
    } catch (err) {
        console.error('Failed to sync holidays during daily background check', err);
    }
};
