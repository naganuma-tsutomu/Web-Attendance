import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduleData } from '../useScheduleData';

const apiMocks = vi.hoisted(() => ({
    getStaffList: vi.fn(),
    getClasses: vi.fn(),
    getTimePatterns: vi.fn(),
    getRoles: vi.fn(),
    getBusinessHours: vi.fn(),
    getExcelSettings: vi.fn(),
    getBreakSettings: vi.fn(),
    getSchedulePreferences: vi.fn(),
    getShiftRequirements: vi.fn(),
    getShiftsByMonth: vi.fn(),
    getPreferencesByMonth: vi.fn(),
    getFixedDates: vi.fn(),
    getHolidays: vi.fn(),
    getBusinessDayOverrides: vi.fn(),
    syncHolidaysIfNeeded: vi.fn(),
}));

vi.mock('../../../../lib/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../../lib/api')>(),
    ...apiMocks,
}));

describe('useScheduleData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiMocks.getStaffList.mockRejectedValue(new Error('staffs unavailable'));
        apiMocks.getClasses.mockResolvedValue([]);
        apiMocks.getTimePatterns.mockResolvedValue([]);
        apiMocks.getRoles.mockResolvedValue([]);
        apiMocks.getBusinessHours.mockResolvedValue({ startHour: 8, endHour: 18, closedDays: [] });
        apiMocks.getExcelSettings.mockResolvedValue({});
        apiMocks.getBreakSettings.mockResolvedValue({});
        apiMocks.getSchedulePreferences.mockResolvedValue({ autoOpenGenerationReport: true });
        apiMocks.getShiftRequirements.mockResolvedValue([]);
        apiMocks.getShiftsByMonth.mockResolvedValue({ shifts: [], version: 1 });
        apiMocks.getPreferencesByMonth.mockResolvedValue([]);
        apiMocks.getFixedDates.mockResolvedValue([]);
        apiMocks.getHolidays.mockResolvedValue([]);
        apiMocks.getBusinessDayOverrides.mockResolvedValue([]);
        apiMocks.syncHolidaysIfNeeded.mockResolvedValue(undefined);
    });

    it('参照データの失敗も集約し、再試行が成功するまで変更を許可しない', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: Infinity } },
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
        const { result, unmount } = renderHook(() => useScheduleData(), { wrapper });

        await waitFor(() => expect(result.current.loadError).not.toBeNull());
        expect(result.current.canMutateSchedule).toBe(false);

        const businessHoursCalls = apiMocks.getBusinessHours.mock.calls.length;
        const fixedDateCalls = apiMocks.getFixedDates.mock.calls.length;
        apiMocks.getStaffList.mockResolvedValue([]);
        act(() => result.current.loadShifts());

        await waitFor(() => expect(result.current.loadError).toBeNull());
        expect(result.current.canMutateSchedule).toBe(true);
        expect(apiMocks.getStaffList).toHaveBeenCalledTimes(2);
        expect(apiMocks.getBusinessHours.mock.calls.length).toBeGreaterThan(businessHoursCalls);
        expect(apiMocks.getFixedDates.mock.calls.length).toBeGreaterThan(fixedDateCalls);

        unmount();
        queryClient.clear();
    });
});
