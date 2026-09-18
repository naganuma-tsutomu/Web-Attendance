import { z } from 'zod';
import type { ShiftPreference } from '../../types';
import { ShiftPreferenceSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getPreferencesByMonth = async (yearMonth: string): Promise<ShiftPreference[]> => {
    return apiFetch<ShiftPreference[]>(`/preferences?yearMonth=${yearMonth}`, {}, z.array(ShiftPreferenceSchema));
};

export const savePreference = async (preference: Omit<ShiftPreference, 'id'>): Promise<void> => {
    await apiFetch('/preferences', {
        method: 'POST',
        body: JSON.stringify(preference)
    });
};

export const updatePreferenceSubmitted = async (staffId: string, yearMonth: string, submitted: boolean): Promise<void> => {
    await apiFetch('/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ staffId, yearMonth, submitted })
    });
};
