import type { RotationSettings } from '../../types';
import { RotationSettingsSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getRotationSettings = async (): Promise<RotationSettings> => {
    return apiFetch<RotationSettings>('/settings/rotation-settings', {}, RotationSettingsSchema);
};

export const updateRotationSettings = async (data: RotationSettings): Promise<void> => {
    await apiFetch('/settings/rotation-settings', { method: 'PUT', body: JSON.stringify(data) });
};
