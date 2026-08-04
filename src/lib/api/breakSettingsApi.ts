import type { BreakSettings } from '../../types';
import { BreakSettingsSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getBreakSettings = async (): Promise<BreakSettings> => {
    return apiFetch<BreakSettings>('/settings/break-rules', {}, BreakSettingsSchema);
};

export const updateBreakSettings = async (data: BreakSettings): Promise<void> => {
    await apiFetch('/settings/break-rules', { method: 'PUT', body: JSON.stringify(data) });
};
