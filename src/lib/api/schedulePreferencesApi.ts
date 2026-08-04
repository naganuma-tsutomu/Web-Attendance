import type { SchedulePreferences } from '../../types';
import { SchedulePreferencesSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getSchedulePreferences = async (): Promise<SchedulePreferences> => {
    return apiFetch<SchedulePreferences>('/settings/schedule-preferences', {}, SchedulePreferencesSchema);
};

export const updateSchedulePreferences = async (data: SchedulePreferences): Promise<void> => {
    await apiFetch('/settings/schedule-preferences', { method: 'PUT', body: JSON.stringify(data) });
};
