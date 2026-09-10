import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Views } from 'react-big-calendar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduleQueries } from '../useScheduleQueries';

const apiMocks = vi.hoisted(() => ({
    getShiftsByMonth: vi.fn(),
    getPreferencesByMonth: vi.fn(),
    getFixedDates: vi.fn(),
}));

vi.mock('../../../../lib/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../../lib/api')>(),
    ...apiMocks,
}));

describe('useScheduleQueries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMocks.getShiftsByMonth.mockResolvedValue({ shifts: [], version: 1 });
        apiMocks.getPreferencesByMonth.mockResolvedValue([]);
        apiMocks.getFixedDates.mockRejectedValue(new Error('fixed dates unavailable'));
    });

    it('固定日の取得失敗を読み込みエラーとして扱い、再試行では全月次データを再取得する', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
        const { result, unmount } = renderHook(
            () => useScheduleQueries(new Date('2025-05-15T00:00:00'), Views.DAY),
            { wrapper },
        );

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.fixedDates.size).toBe(0);
        expect(apiMocks.getShiftsByMonth).toHaveBeenCalledTimes(1);
        expect(apiMocks.getPreferencesByMonth).toHaveBeenCalledTimes(1);
        expect(apiMocks.getFixedDates).toHaveBeenCalledTimes(1);

        apiMocks.getFixedDates.mockResolvedValue(['2025-05-10']);
        await act(async () => {
            await result.current.refetch();
        });

        await waitFor(() => expect(result.current.isError).toBe(false));
        expect(result.current.fixedDates.has('2025-05-10')).toBe(true);
        expect(apiMocks.getShiftsByMonth).toHaveBeenCalledTimes(2);
        expect(apiMocks.getPreferencesByMonth).toHaveBeenCalledTimes(2);
        expect(apiMocks.getFixedDates).toHaveBeenCalledTimes(2);

        unmount();
        queryClient.clear();
    });
});
