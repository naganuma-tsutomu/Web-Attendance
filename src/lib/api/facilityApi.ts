import { z } from 'zod';
import { apiFetch } from '../apiClient';

const FacilitySchema = z.object({ name: z.string() });

export const getFacilityName = async (): Promise<string> => {
    const res = await apiFetch<{ name: string }>('/settings/facility', {}, FacilitySchema);
    return res.name;
};

export const updateFacilityName = async (name: string): Promise<void> => {
    await apiFetch('/settings/facility', { method: 'PUT', body: JSON.stringify({ name }) });
};
