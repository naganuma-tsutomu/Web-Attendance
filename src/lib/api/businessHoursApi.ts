import type { BusinessHours } from '../../types';
import { BusinessHoursSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getBusinessHours = async (): Promise<BusinessHours> => {
    return apiFetch<BusinessHours>('/settings/business-hours', {}, BusinessHoursSchema);
};

export const updateBusinessHours = async (data: BusinessHours): Promise<void> => {
    await apiFetch('/settings/business-hours', { method: 'PUT', body: JSON.stringify(data) });
};
