import { useInfiniteQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../api';
import { QUERY_KEYS } from './queryKeys';

export const useAuditLogs = (yearMonth: string, action = '') => useInfiniteQuery({
    queryKey: QUERY_KEYS.auditLogs(yearMonth, action),
    queryFn: ({ pageParam }) => getAuditLogs({
        yearMonth,
        action: action || undefined,
        cursor: pageParam ?? undefined,
        limit: 100,
    }),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: 0,
    refetchOnMount: 'always',
});
