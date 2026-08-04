import type { AuditLog } from '../../types';
import { AuditLogPageSchema } from '../../types/schemas';
import { apiFetch } from '../apiClient';

export const getAuditLogs = async (params: { yearMonth?: string; action?: string; cursor?: string; limit?: number } = {}): Promise<{ items: AuditLog[]; nextCursor: string | null }> => {
    const search = new URLSearchParams();
    if (params.yearMonth) search.set('yearMonth', params.yearMonth);
    if (params.action) search.set('action', params.action);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit) search.set('limit', String(params.limit));
    return apiFetch(`/audit-logs?${search.toString()}`, {}, AuditLogPageSchema) as Promise<{ items: AuditLog[]; nextCursor: string | null }>;
};
