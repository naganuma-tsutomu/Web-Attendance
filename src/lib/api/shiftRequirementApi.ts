import { z } from 'zod';
import type { ShiftRequirement, ShiftRequirementTemplate } from '../../types';
import { ShiftRequirementSchema, ShiftRequirementTemplateSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getShiftRequirements = async (): Promise<ShiftRequirement[]> => {
    return apiFetch<ShiftRequirement[]>('/settings/shift-requirements', {}, z.array(ShiftRequirementSchema));
};

export const saveShiftRequirements = async (requirements: ShiftRequirement[]): Promise<void> => {
    await apiFetch('/settings/shift-requirements', {
        method: 'POST',
        body: JSON.stringify(requirements)
    });
};

export const deleteShiftRequirement = async (id: string): Promise<void> => {
    await apiFetch(`/settings/shift-requirements/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const getShiftRequirementTemplates = async (): Promise<ShiftRequirementTemplate[]> => {
    return apiFetch<ShiftRequirementTemplate[]>(
        '/settings/shift-requirement-templates',
        {},
        z.array(ShiftRequirementTemplateSchema)
    );
};

export const createShiftRequirementTemplate = async (name: string): Promise<string> => {
    const result = await apiFetch<{ id: string }>('/settings/shift-requirement-templates', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
    return result.id;
};

export const renameShiftRequirementTemplate = async (id: string, name: string): Promise<void> => {
    await apiFetch(`/settings/shift-requirement-templates/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name })
    });
};

export const deleteShiftRequirementTemplate = async (id: string): Promise<void> => {
    await apiFetch(`/settings/shift-requirement-templates/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
};

export const applyShiftRequirementTemplate = async (id: string): Promise<void> => {
    await apiFetch(`/settings/shift-requirement-templates/${encodeURIComponent(id)}/apply`, {
        method: 'POST'
    });
};

export const overwriteShiftRequirementTemplate = async (id: string): Promise<void> => {
    await apiFetch(`/settings/shift-requirement-templates/${encodeURIComponent(id)}/capture`, {
        method: 'POST'
    });
};
