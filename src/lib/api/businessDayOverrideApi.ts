import { z } from 'zod';
import type { BusinessDayOverride } from '../../types';
import { BusinessDayOverrideSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getBusinessDayOverrides = async (yearMonth?: string, year?: number): Promise<BusinessDayOverride[]> => {
    const query = yearMonth ? `?yearMonth=${encodeURIComponent(yearMonth)}` : year ? `?year=${year}` : '';
    return apiFetch<BusinessDayOverride[]>(`/settings/business-day-overrides${query}`, {}, z.array(BusinessDayOverrideSchema));
};

export const createBusinessDayOverride = async (data: Omit<BusinessDayOverride, 'id' | 'created_at' | 'updated_at'>): Promise<string> => {
    const result = await apiFetch<{ id: string }>('/settings/business-day-overrides', {
        method: 'POST', body: JSON.stringify(data)
    }, z.object({ id: z.string() }));
    return result.id;
};

export const createBusinessDayOverridesBulk = async (data: {
    startDate: string;
    endDate: string;
    status: BusinessDayOverride['status'];
    name: string;
}): Promise<{ ids: string[]; count: number }> => apiFetch('/settings/business-day-overrides/bulk', {
    method: 'POST', body: JSON.stringify(data)
}, z.object({ ids: z.array(z.string()), count: z.number().int().nonnegative() }));

export const updateBusinessDayOverride = async (id: string, data: Pick<BusinessDayOverride, 'status' | 'name'>): Promise<void> => {
    await apiFetch(`/settings/business-day-overrides/${encodeURIComponent(id)}`, {
        method: 'PUT', body: JSON.stringify(data)
    });
};

export const deleteBusinessDayOverride = async (id: string): Promise<void> => {
    await apiFetch(`/settings/business-day-overrides/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
