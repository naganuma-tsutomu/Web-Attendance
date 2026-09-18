import type { ExcelSettings } from '../../types';
import { ExcelSettingsSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getExcelSettings = async (): Promise<ExcelSettings> => {
    return apiFetch<ExcelSettings>('/settings/excel-settings', {}, ExcelSettingsSchema);
};

export const updateExcelSettings = async (data: ExcelSettings): Promise<void> => {
    await apiFetch('/settings/excel-settings', { method: 'PUT', body: JSON.stringify(data) });
};
