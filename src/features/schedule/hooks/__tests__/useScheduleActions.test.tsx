import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useScheduleActions } from '../useScheduleActions';

const mutationMocks = vi.hoisted(() => ({
    saveShifts: vi.fn(),
    replaceShifts: vi.fn(),
    updateShift: vi.fn(),
    deleteShifts: vi.fn(),
    createSnapshot: vi.fn(),
    toggleFixedDate: vi.fn(),
    saveFixedDates: vi.fn(),
}));

const mutation = (mutateAsync: ReturnType<typeof vi.fn>) => ({
    mutateAsync,
    mutate: mutateAsync,
    isPending: false,
});

vi.mock('../../../../lib/hooks', () => ({
    useSaveShiftsBatch: () => mutation(mutationMocks.saveShifts),
    useReplaceShiftsForMonth: () => mutation(mutationMocks.replaceShifts),
    useUpdateShift: () => mutation(mutationMocks.updateShift),
    useDeleteShiftsByMonth: () => mutation(mutationMocks.deleteShifts),
    useCreateShiftSnapshot: () => mutation(mutationMocks.createSnapshot),
    useToggleFixedDate: () => mutation(mutationMocks.toggleFixedDate),
    useSaveFixedDates: () => mutation(mutationMocks.saveFixedDates),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
    },
}));

describe('useScheduleActions', () => {
    it('読み込み未完了または失敗中は、消去・固定日変更・編集を実行しない', async () => {
        const { result } = renderHook(() => useScheduleActions({
            currentDate: new Date('2025-05-15T00:00:00'),
            targetYearMonth: '2025-05',
            fixedDates: new Set(),
            rawShifts: [],
            classes: [],
            autoOpenGenerationReport: true,
            canMutateSchedule: false,
        }));

        act(() => {
            result.current.handleClearShifts();
            result.current.toggleFixedDate('2025-05-10');
        });
        expect(result.current.confirmAction).toBeNull();

        await expect(result.current.handleUpdateShift({
            staffId: 'staff-1',
            date: '2025-05-10',
            startTime: '09:00',
            endTime: '18:00',
        }, null)).rejects.toThrow('データの再読み込みが完了するまで');

        expect(mutationMocks.deleteShifts).not.toHaveBeenCalled();
        expect(mutationMocks.toggleFixedDate).not.toHaveBeenCalled();
        expect(mutationMocks.updateShift).not.toHaveBeenCalled();
        expect(mutationMocks.saveShifts).not.toHaveBeenCalled();
    });
});
