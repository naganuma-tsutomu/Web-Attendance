import { z } from 'zod';
import { apiFetch } from '../apiClient';

export const getFixedDates = async (yearMonth: string): Promise<string[]> => {
    return apiFetch<string[]>(`/fixed-dates?yearMonth=${yearMonth}`, {}, z.array(z.string()));
};

export const saveFixedDates = async (yearMonth: string, dates: string[]): Promise<void> => {
    await apiFetch('/fixed-dates', { method: 'POST', body: JSON.stringify({ yearMonth, dates }) });
};

export const toggleFixedDate = async (date: string, fixed: boolean): Promise<void> => {
    await apiFetch('/fixed-dates', { method: 'PATCH', body: JSON.stringify({ date, fixed }) });
};
