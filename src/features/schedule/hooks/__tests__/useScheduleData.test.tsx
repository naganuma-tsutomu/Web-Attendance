import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduleData } from '../useScheduleData';

const apiMocks = vi.hoisted(() => ({
    getScheduleBootstrap: vi.fn(),
    syncHolidaysIfNeeded: vi.fn(),
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
        fixedDates: [],
        businessDayOverrides: [],
    }])),
    holidays: Object.fromEntries(Array.from(new Set(months.map(month => month.slice(0, 4))), year => [year, []])),
});

describe('useScheduleData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMocks.getScheduleBootstrap.mockRejectedValue(new Error('bootstrap unavailable'));
        apiMocks.syncHolidaysIfNeeded.mockResolvedValue(undefined);
    });

    it('集約取得の失敗時は変更を禁止し、再試行と通常再読込も1リクエストで行う', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
        const { result, unmount } = renderHook(() => useScheduleData(), { wrapper });

        await waitFor(() => expect(result.current.loadError).not.toBeNull());
        expect(result.current.canMutateSchedule).toBe(false);
        expect(apiMocks.getScheduleBootstrap).toHaveBeenCalledTimes(1);

        apiMocks.getScheduleBootstrap.mockImplementation(async (months: string[]) => createBootstrapData(months));
        act(() => result.current.retryLoad());

        await waitFor(() => expect(result.current.loadError).toBeNull());
        expect(result.current.canMutateSchedule).toBe(true);
        expect(apiMocks.getScheduleBootstrap).toHaveBeenCalledTimes(2);

        act(() => result.current.loadShifts());
        await waitFor(() => expect(apiMocks.getScheduleBootstrap).toHaveBeenCalledTimes(3));

        unmount();
        queryClient.clear();
    });
});
