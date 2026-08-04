import { z } from 'zod';
import type { ShiftSnapshotMetadata } from '../../types';
import { ShiftSnapshotMetadataSchema } from '../../types/schemas';
import { API_BASE, apiFetch } from '../apiClient';
import { ApiError } from '../errorHandler';

export const getShiftSnapshots = async (yearMonth: string): Promise<ShiftSnapshotMetadata[]> => {
    return apiFetch<ShiftSnapshotMetadata[]>(
        `/shifts/snapshots?yearMonth=${yearMonth}`,
        {},
        z.array(ShiftSnapshotMetadataSchema)
    );
};

export const createShiftSnapshot = async (
    yearMonth: string,
    reason: string,
    label?: string | null
): Promise<{ id: string; yearMonth: string; label: string | null; reason: string; shiftCount: number; fixedDateCount: number }> => {
    return apiFetch('/shifts/snapshots', {
        method: 'POST',
        body: JSON.stringify({ yearMonth, reason, label })
    });
};

export const restoreShiftSnapshot = async (
    id: string
): Promise<{ success: boolean; yearMonth: string; restoredShiftCount: number; restoredFixedDateCount: number }> => {
    return apiFetch(`/shifts/snapshots/${encodeURIComponent(id)}/restore`, {
        method: 'POST',
        body: JSON.stringify({})
    });
};

export const downloadShiftSnapshotCsv = async (id: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/shifts/snapshots/${encodeURIComponent(id)}/export`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string; message?: string };
        throw new ApiError(response.status, errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`);
    }
    return response.blob();
};
