import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../api';
import { QUERY_KEYS } from './queryKeys';

export const useAuditLogs = (yearMonth: string, action = '') => useQuery({
    queryKey: QUERY_KEYS.auditLogs(yearMonth, action),
    queryFn: () => getAuditLogs({ yearMonth, action: action || undefined, limit: 100 }),
    staleTime: 0,
    refetchOnMount: 'always',
});
