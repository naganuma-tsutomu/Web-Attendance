import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Shift } from '../../../../types';
import { resolveBusinessHours, useShiftEdit } from '../useShiftEdit';

const apiMocks = vi.hoisted(() => ({ replaceShiftsForDay: vi.fn() }));

vi.mock('../../../../lib/api', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../../../lib/api')>(),
    replaceShiftsForDay: apiMocks.replaceShiftsForDay,
}));

describe('useShiftEdit', () => {
    it('日別の削除・追加・更新を1回の置換APIへまとめる', async () => {
        apiMocks.replaceShiftsForDay.mockResolvedValue(undefined);
        const onShiftUpdate = vi.fn();
        const saveRef = { current: null as (() => Promise<void>) | null };
        const shifts: Shift[] = [
            { id: 'keep', date: '2026-08-03', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'c1', duty_number: 3 },
            { id: 'remove', date: '2026-08-03', staffId: 's2', startTime: '09:00', endTime: '18:00', classType: 'c1' },
        ];
        const { result } = renderHook(() => useShiftEdit({
            shifts,
            date: new Date('2026-08-03T00:00:00'),
            staffList: [
                { id: 's1' },
                { id: 's2' },
                { id: 's3', defaultWorkingHoursStart: '10:00', defaultWorkingHoursEnd: '15:00' },
            ],
            timePatterns: [],
            hours: resolveBusinessHours(),
            onShiftUpdate,
            saveRef,
            expectedVersion: 7,
        }));

        act(() => {
            result.current.dispatch({ type: 'UPDATE_LOCAL', id: 'keep', data: { end: 17 * 60, classType: 'c2' } });
            result.current.handleRemoveShift('remove');
            result.current.handleAddStaff('s3', 'c1');
        });
        await act(async () => {
            await saveRef.current?.();
        });

        expect(apiMocks.replaceShiftsForDay).toHaveBeenCalledTimes(1);
        expect(apiMocks.replaceShiftsForDay).toHaveBeenCalledWith('2026-08-03', 7, [
            expect.objectContaining({
                id: 'keep', staffId: 's1', startTime: '09:00', endTime: '17:00', classType: 'c2', duty_number: 3,
            }),
            expect.not.objectContaining({
                id: expect.anything(),
                staffId: 's3',
            }),
        ]);
        expect(apiMocks.replaceShiftsForDay.mock.calls[0][2][1]).toMatchObject({
            staffId: 's3', startTime: '10:00', endTime: '15:00', classType: 'c1',
        });
        expect(apiMocks.replaceShiftsForDay.mock.calls[0][2]).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'remove' })]),
        );
        expect(onShiftUpdate).toHaveBeenCalledTimes(1);
    });
});
