import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShiftBackupModal from '../ShiftBackupModal';

const mocks = vi.hoisted(() => ({
    snapshots: [] as Array<{ id: string; yearMonth: string; label?: string | null; reason: string; shiftCount: number; createdAt: string }>,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    create: { mutateAsync: vi.fn(), isPending: false },
    restore: { mutateAsync: vi.fn(), isPending: false },
    download: vi.fn(),
    handleApiError: vi.fn(),
    toastSuccess: vi.fn(),
    objectUrl: vi.fn(() => 'blob:test'),
    revokeUrl: vi.fn(),
    linkClick: vi.fn(),
}));

vi.mock('../../../../lib/hooks', () => ({
    useShiftSnapshots: () => ({ data: mocks.snapshots, isLoading: mocks.isLoading, isError: mocks.isError, refetch: mocks.refetch }),
    useCreateShiftSnapshot: () => mocks.create,
    useRestoreShiftSnapshot: () => mocks.restore,
}));
vi.mock('../../../../lib/api', () => ({ downloadShiftSnapshotCsv: mocks.download }));
vi.mock('../../../../lib/errorHandler', () => ({ handleApiError: mocks.handleApiError }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock('../../../../components/ui/Modal', () => ({
    default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));
vi.mock('../../../../components/ui/ConfirmModal', () => ({
    default: ({ isOpen, title, onConfirm, onCancel }: { isOpen: boolean; title: string; onConfirm(): void; onCancel(): void }) => isOpen ? (
        <div><span>{title}</span><button onClick={onConfirm}>復元を確定</button><button onClick={onCancel}>復元を中止</button></div>
    ) : null,
}));

const snapshots = [
    { id: 'old', yearMonth: '2026-08', label: null, reason: 'before-clear', shiftCount: 10, createdAt: '2026-08-01 09:00:00' },
    { id: 'new', yearMonth: '2026-08', label: '月初/保存', reason: 'manual', shiftCount: 20, createdAt: '2026-08-02 10:30:00' },
];

describe('ShiftBackupModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.snapshots = [...snapshots];
        mocks.isLoading = false;
        mocks.isError = false;
        mocks.create.isPending = false;
        mocks.restore.isPending = false;
        mocks.create.mutateAsync.mockResolvedValue({});
        mocks.restore.mutateAsync.mockResolvedValue({ restoredShiftCount: 20 });
        mocks.download.mockResolvedValue(new Blob(['csv']));
        vi.stubGlobal('URL', { createObjectURL: mocks.objectUrl, revokeObjectURL: mocks.revokeUrl });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(mocks.linkClick);
    });

    it('新しい順に一覧表示し、理由と件数を表示する', () => {
        render(<ShiftBackupModal isOpen yearMonth="2026-08" onClose={vi.fn()} onRestored={vi.fn()} />);

        const labels = screen.getAllByText(/月初\/保存|消去前/).map(node => node.textContent);
        expect(labels[0]).toBe('月初/保存');
        expect(screen.getByText('2026/8/2 10:30 / 20件')).toBeInTheDocument();
        expect(screen.getAllByText('消去前').length).toBeGreaterThan(0);
    });

    it('メモを整形してバックアップを作成し、一覧を再取得する', async () => {
        render(<ShiftBackupModal isOpen yearMonth="2026-08" onClose={vi.fn()} onRestored={vi.fn()} />);
        const input = screen.getByPlaceholderText('メモ（任意）');
        fireEvent.change(input, { target: { value: '  作業前  ' } });
        fireEvent.click(screen.getByRole('button', { name: '作成' }));

        await waitFor(() => expect(mocks.create.mutateAsync).toHaveBeenCalledWith({ yearMonth: '2026-08', reason: 'manual', label: '作業前' }));
        expect(mocks.refetch).toHaveBeenCalledOnce();
        expect(mocks.toastSuccess).toHaveBeenCalledWith('バックアップを作成しました');
        expect(input).toHaveValue('');
    });

    it('一覧取得失敗を空データと区別し、再試行できる', () => {
        mocks.snapshots = [];
        mocks.isError = true;
        render(<ShiftBackupModal isOpen yearMonth="2026-08" onClose={vi.fn()} onRestored={vi.fn()} />);

        expect(screen.getByRole('alert')).toHaveTextContent('バックアップの読み込みに失敗しました');
        expect(screen.queryByText('まだバックアップはありません')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '再試行' }));
        expect(mocks.refetch).toHaveBeenCalledOnce();
    });

    it('確認後に復元し、画面を更新して閉じる', async () => {
        const onClose = vi.fn();
        const onRestored = vi.fn();
        render(<ShiftBackupModal isOpen yearMonth="2026-08" onClose={onClose} onRestored={onRestored} />);

        fireEvent.click(screen.getAllByRole('button', { name: '復元' })[0]);
        fireEvent.click(screen.getByRole('button', { name: '復元を確定' }));

        await waitFor(() => expect(mocks.restore.mutateAsync).toHaveBeenCalledWith({ id: 'new' }));
        expect(mocks.toastSuccess).toHaveBeenCalledWith('20件のシフトを復元しました');
        expect(onRestored).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('CSVを安全なファイル名で出力する', async () => {
        render(<ShiftBackupModal isOpen yearMonth="2026-08" onClose={vi.fn()} onRestored={vi.fn()} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'CSV' })[0]);

        await waitFor(() => expect(mocks.download).toHaveBeenCalledWith('new'));
        expect(mocks.objectUrl).toHaveBeenCalled();
        expect(mocks.linkClick).toHaveBeenCalledOnce();
        expect(mocks.revokeUrl).toHaveBeenCalledWith('blob:test');
        expect(mocks.toastSuccess).toHaveBeenCalledWith('CSVを出力しました');
    });

    it('作成・復元・CSVの失敗を共通エラー処理へ渡す', async () => {
        mocks.create.mutateAsync.mockRejectedValueOnce(new Error('create failed'));
        mocks.restore.mutateAsync.mockRejectedValueOnce(new Error('restore failed'));
        mocks.download.mockRejectedValueOnce(new Error('export failed'));
        render(<ShiftBackupModal isOpen yearMonth="2026-08" onClose={vi.fn()} onRestored={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: '作成' }));
        await waitFor(() => expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), 'バックアップの作成に失敗しました'));
        fireEvent.click(screen.getAllByRole('button', { name: '復元' })[0]);
        fireEvent.click(screen.getByRole('button', { name: '復元を確定' }));
        await waitFor(() => expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), 'バックアップの復元に失敗しました'));
        fireEvent.click(screen.getAllByRole('button', { name: 'CSV' })[0]);
        await waitFor(() => expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), 'CSV出力に失敗しました'));
    });
});
