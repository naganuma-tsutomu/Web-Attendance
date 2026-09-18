import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Views } from 'react-big-calendar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '../../../../lib/hooks';
import { useScheduleQueries } from '../useScheduleQueries';

const apiMocks = vi.hoisted(() => ({
    getScheduleBootstrap: vi.fn(),
}));

vi.mock('../../../../lib/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../../lib/api')>(),
    ...apiMocks,
}));

const createBootstrapData = (months: string[]) => ({
    references: {
        staffs: [],
        classes: [],
        timePatterns: [],
        roles: [],
        businessHours: { startHour: 8, endHour: 19, closedDays: [0] },
        excelSettings: { excludeHolidayStaffOnSaturdays: true, highlightRules: [], showDutyNumbers: false, leaderRoleId: null },
        breakSettings: {
            exceptionEnabled: false,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 30,
            displayActualHoursInModal: false,
            displayActualHoursInExcel: false,
        },
        schedulePreferences: { autoOpenGenerationReport: true },
        shiftRequirements: [],
    },
    months: Object.fromEntries(months.map(month => [month, {
        shifts: { shifts: [], version: 1 },
        preferences: [],
        fixedDates: ['2025-05-10'],
        businessDayOverrides: [],
    }])),
    holidays: Object.fromEntries(Array.from(new Set(months.map(month => month.slice(0, 4))), year => [year, []])),
});

describe('useScheduleQueries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMocks.getScheduleBootstrap.mockRejectedValue(new Error('fixed dates unavailable'));
    });

    it('初期データを1回で取得し、失敗時の再試行後に個別キャッシュも更新する', async () => {
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
        expect(apiMocks.getScheduleBootstrap).toHaveBeenCalledTimes(1);
        expect(apiMocks.getScheduleBootstrap).toHaveBeenLastCalledWith(['2025-05']);

        apiMocks.getScheduleBootstrap.mockImplementation(async (months: string[]) => createBootstrapData(months));
        await act(async () => {
            await result.current.refetch();
        });

        await waitFor(() => expect(result.current.isError).toBe(false));
        expect(result.current.fixedDates.has('2025-05-10')).toBe(true);
        expect(result.current.shiftMonthVersions['2025-05']).toBe(1);
        expect(apiMocks.getScheduleBootstrap).toHaveBeenCalledTimes(2);
        expect(queryClient.getQueryData(QUERY_KEYS.fixedDates('2025-05'))).toEqual(['2025-05-10']);
        expect(queryClient.getQueryData(QUERY_KEYS.shifts('2025-05'))).toEqual({ shifts: [], version: 1 });
        expect(queryClient.getQueryData(QUERY_KEYS.businessHours)).toEqual({ startHour: 8, endHour: 19, closedDays: [0] });

        unmount();
        queryClient.clear();
    });
});
