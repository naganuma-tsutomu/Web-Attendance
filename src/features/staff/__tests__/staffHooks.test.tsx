import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessHours, DynamicRole, Staff } from '../../../types';
import { useStaffForm } from '../hooks/useStaffForm';
import { useStaffListActions } from '../hooks/useStaffListActions';

const mocks = vi.hoisted(() => ({
    createStaff: { mutateAsync: vi.fn(), isPending: false },
    updateStaff: { mutateAsync: vi.fn(), isPending: false },
    deleteStaff: { mutateAsync: vi.fn() },
    updateOrder: { mutate: vi.fn() },
    handleApiError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('../../../lib/hooks', () => ({
    useCreateStaff: () => mocks.createStaff,
    useUpdateStaff: () => mocks.updateStaff,
    useDeleteStaff: () => mocks.deleteStaff,
    useUpdateStaffOrder: () => mocks.updateOrder,
}));
vi.mock('../../../lib/errorHandler', () => ({ handleApiError: mocks.handleApiError }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }));

const roles: DynamicRole[] = [
    { id: 'role-1', name: '常勤', targetHours: 160, weeklyHoursTarget: 40, display_order: 1, patterns: [] },
    { id: 'role-2', name: '短時間', targetHours: 100, weeklyHoursTarget: 25, display_order: 2, patterns: [] },
];
const businessHours: BusinessHours = { startHour: 8, endHour: 19, closedDays: [0, 3] };
const staffs: Staff[] = [
    { id: 's1', name: '山田', role: '常勤', hoursTarget: 160, weeklyHoursTarget: 40, classIds: ['c1'] },
    { id: 's2', name: '佐藤', role: '短時間', hoursTarget: 100, weeklyHoursTarget: 25, classIds: ['c2'] },
];

describe('useStaffForm', () => {
    beforeEach(() => vi.clearAllMocks());

    it('追加フォームに役職既定値と営業曜日を設定する', () => {
        const { result } = renderHook(() => useStaffForm(roles, businessHours));

        act(() => result.current.openAddForm());

        expect(result.current.isOpen).toBe(true);
        expect(result.current.editingStaff).toBeNull();
        expect(result.current.formData).toMatchObject({
            role: '常勤', hoursTarget: 160, weeklyHoursTarget: 40,
            availableDays: [1, 2, 4, 5, 6],
        });
    });

    it('編集値を読み込み、役職変更時に目標時間も更新する', () => {
        const { result } = renderHook(() => useStaffForm(roles, businessHours));

        act(() => result.current.openEditForm({ ...staffs[0], accessKey: '123456', availableDays: [1, 2] }));
        expect(result.current.formData).toMatchObject({ name: '山田', accessKey: '123456', availableDays: [1, 2] });

        act(() => result.current.handleRoleChange('短時間'));
        expect(result.current.formData).toMatchObject({ role: '短時間', hoursTarget: 100, weeklyHoursTarget: 25 });
    });

    it('追加と更新を保存し、失敗時は共通エラー処理へ渡す', async () => {
        const { result } = renderHook(() => useStaffForm(roles, businessHours));
        act(() => result.current.openAddForm());
        await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as never));
        expect(mocks.createStaff.mutateAsync).toHaveBeenCalled();
        expect(mocks.toastSuccess).toHaveBeenCalledWith('スタッフを追加しました。');

        act(() => result.current.openEditForm(staffs[0]));
        await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as never));
        expect(mocks.updateStaff.mutateAsync).toHaveBeenCalledWith({ id: 's1', data: expect.objectContaining({ name: '山田' }) });

        mocks.updateStaff.mutateAsync.mockRejectedValueOnce(new Error('failed'));
        await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as never));
        expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), '保存に失敗しました');
    });
});

describe('useStaffListActions', () => {
    beforeEach(() => vi.clearAllMocks());

    it('削除確認から削除を実行し、成功時に対象を閉じる', async () => {
        const { result } = renderHook(() => useStaffListActions(staffs));
        act(() => result.current.requestDelete('s1', '山田'));
        expect(result.current.deleteTarget).toEqual({ id: 's1', name: '山田' });

        await act(async () => result.current.confirmDelete());
        expect(mocks.deleteStaff.mutateAsync).toHaveBeenCalledWith('s1');
        expect(mocks.toastSuccess).toHaveBeenCalledWith('スタッフを削除しました。');
        expect(result.current.deleteTarget).toBeNull();
    });

    it('削除失敗を通知し、対象を維持する', async () => {
        mocks.deleteStaff.mutateAsync.mockRejectedValueOnce(new Error('failed'));
        const { result } = renderHook(() => useStaffListActions(staffs));
        act(() => result.current.requestDelete('s1', '山田'));

        await act(async () => result.current.confirmDelete());
        expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), '削除に失敗しました');
        expect(result.current.deleteTarget).toEqual({ id: 's1', name: '山田' });
        expect(result.current.isDeleting).toBe(false);
    });

    it('ドラッグ中のスタッフを保持し、並び替え順を保存する', () => {
        const { result } = renderHook(() => useStaffListActions(staffs));
        act(() => result.current.handleDragStart({ active: { id: 's1' } } as never));
        expect(result.current.activeStaff?.id).toBe('s1');

        act(() => result.current.handleDragEnd({ active: { id: 's1' }, over: { id: 's2' } } as never));
        expect(result.current.activeStaff).toBeNull();
        expect(mocks.updateOrder.mutate).toHaveBeenCalledWith(
            [{ id: 's2', order: 1 }, { id: 's1', order: 2 }],
            expect.objectContaining({ onError: expect.any(Function) }),
        );
    });
});
