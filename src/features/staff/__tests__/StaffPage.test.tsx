import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffPage from '../StaffPage';

const mocks = vi.hoisted(() => ({
    refetchStaff: vi.fn(), refetchRoles: vi.fn(), refetchClasses: vi.fn(), refetchShifts: vi.fn(),
    openAddForm: vi.fn(), openEditForm: vi.fn(), requestDelete: vi.fn(),
    staffError: false,
}));

vi.mock('../../../lib/hooks', () => ({
    useStaffList: () => ({
        data: [
            { id: 's1', name: '山田', role: '常勤', classIds: [] },
            { id: 's2', name: '佐藤', role: '短時間', classIds: [] },
        ],
        isLoading: false, isError: mocks.staffError, refetch: mocks.refetchStaff,
    }),
    useRoles: () => ({ data: [{ id: 'r1', name: '常勤', display_order: 1, targetHours: 160, patterns: [] }], isLoading: false, isError: false, refetch: mocks.refetchRoles }),
    useClasses: () => ({ data: [], isLoading: false, isError: false, refetch: mocks.refetchClasses }),
    useBusinessHours: () => ({ data: { startHour: 8, endHour: 19, closedDays: [0] } }),
    useShiftsByMonth: () => ({ data: [], isLoading: false, isFetching: false, refetch: mocks.refetchShifts }),
    useBreakSettings: () => ({ data: undefined }),
}));
vi.mock('../../../utils/timeUtils', () => ({ calculateTotalHours: () => ({ s1: 120 }) }));
vi.mock('../../../utils/dateUtils', () => ({
    loadActiveMonth: () => new Date(2026, 7, 1),
    saveActiveMonth: vi.fn(),
}));
vi.mock('../hooks/useStaffForm', () => ({
    useStaffForm: () => ({
        isOpen: false, editingStaff: null, formData: {}, setFormData: vi.fn(), isSubmitting: false,
        openAddForm: mocks.openAddForm, openEditForm: mocks.openEditForm,
        closeForm: vi.fn(), handleSubmit: vi.fn(), handleRoleChange: vi.fn(),
    }),
}));
vi.mock('../hooks/useStaffListActions', () => ({
    useStaffListActions: () => ({
        activeStaff: null, deleteTarget: null, isDeleting: false,
        requestDelete: mocks.requestDelete, cancelDelete: vi.fn(), confirmDelete: vi.fn(),
        handleDragStart: vi.fn(), handleDragEnd: vi.fn(),
    }),
}));
vi.mock('../components/StaffPageHeader', () => ({ default: ({ error, onAdd, onRetry }: { error: string; onAdd(): void; onRetry(): void }) => (
    <div><button onClick={onAdd}>スタッフ追加</button>{error && <><span role="alert">{error}</span><button onClick={onRetry}>再試行</button></>}</div>
) }));
vi.mock('../components/StaffListToolbar', () => ({ default: ({ searchTerm, onSearchChange }: { searchTerm: string; onSearchChange(value: string): void }) => (
    <input aria-label="スタッフ検索" value={searchTerm} onChange={event => onSearchChange(event.target.value)} />
) }));
vi.mock('../components/StaffMobileList', () => ({ default: ({ staffs }: { staffs: Array<{ id: string; name: string }> }) => (
    <div data-testid="staff-list">{staffs.map(staff => <span key={staff.id}>{staff.name}</span>)}</div>
) }));
vi.mock('../components/StaffDesktopTable', () => ({ default: () => null }));
vi.mock('../components/StaffFormModal', () => ({ default: () => null }));
vi.mock('../components/StaffDeleteConfirmModal', () => ({ default: () => null }));

describe('StaffPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.staffError = false;
    });

    it('スタッフを表示し、名前で絞り込み、追加画面を開く', () => {
        render(<StaffPage />);
        expect(screen.getByText('山田')).toBeInTheDocument();
        expect(screen.getByText('佐藤')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('スタッフ検索'), { target: { value: '山' } });
        expect(screen.getByText('山田')).toBeInTheDocument();
        expect(screen.queryByText('佐藤')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('スタッフ追加'));
        expect(mocks.openAddForm).toHaveBeenCalledOnce();
    });

    it('読込みエラーを表示し、全データを再取得する', () => {
        mocks.staffError = true;
        render(<StaffPage />);

        expect(screen.getByRole('alert')).toHaveTextContent('データの読み込みに失敗しました。');
        fireEvent.click(screen.getByText('再試行'));
        expect(mocks.refetchStaff).toHaveBeenCalledOnce();
        expect(mocks.refetchRoles).toHaveBeenCalledOnce();
        expect(mocks.refetchClasses).toHaveBeenCalledOnce();
        expect(mocks.refetchShifts).toHaveBeenCalledOnce();
    });
});
