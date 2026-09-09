import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShiftClass, Staff } from '../../../../types';
import ShiftImportModal from '../ShiftImportModal';
import { MAX_CSV_FILE_BYTES } from '../../utils/shiftImport';

const mocks = vi.hoisted(() => ({
    save: { mutateAsync: vi.fn(), isPending: false },
    replace: { mutateAsync: vi.fn(), isPending: false },
    snapshot: { mutateAsync: vi.fn(), isPending: false },
    handleApiError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('../../../../lib/hooks', () => ({
    useSaveShiftsBatch: () => mocks.save,
    useReplaceShiftsForMonth: () => mocks.replace,
    useCreateShiftSnapshot: () => mocks.snapshot,
}));
vi.mock('../../../../lib/errorHandler', () => ({ handleApiError: mocks.handleApiError }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }));
vi.mock('../../../../components/ui/Modal', () => ({
    default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div>{children}</div> : null,
}));

const staffList: Staff[] = [
    { id: 's1', name: '山田', role: '常勤', hoursTarget: 160, weeklyHoursTarget: 40 },
];
const classes: ShiftClass[] = [
    { id: 'c1', name: '虹組', display_order: 1, auto_allocate: 1 },
];
const csv = 'date,staffName,className,startTime,endTime,dutyNumber\n2026-08-01,山田,虹組,09:00,18:00,1';

const makeFile = (name: string, text: string, size = text.length): File => ({
    name,
    size,
    text: vi.fn().mockResolvedValue(text),
} as unknown as File);

const renderModal = (overrides: Partial<React.ComponentProps<typeof ShiftImportModal>> = {}) => {
    const props: React.ComponentProps<typeof ShiftImportModal> = {
        isOpen: true,
        yearMonth: '2026-08',
        staffList,
        classes,
        existingShifts: [],
        fixedDates: new Set(),
        onClose: vi.fn(),
        onImported: vi.fn(),
        ...overrides,
    };
    const result = render(<ShiftImportModal {...props} />);
    return { ...result, props, input: result.container.querySelector('input[type="file"]') as HTMLInputElement };
};

describe('ShiftImportModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.save.mutateAsync.mockResolvedValue({});
        mocks.replace.mutateAsync.mockResolvedValue({});
        mocks.snapshot.mutateAsync.mockResolvedValue({});
    });

    it('CSVをプレビューしてバックアップ後に追加取り込みする', async () => {
        const { input, props } = renderModal();
        fireEvent.change(input, { target: { files: [makeFile('shifts.csv', csv)] } });

        expect(await screen.findByText('1件を読み込み済み / 取込 1件 / スキップ 0件')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '取り込む' }));

        await waitFor(() => expect(mocks.snapshot.mutateAsync).toHaveBeenCalledWith({
            yearMonth: '2026-08', reason: 'before-import', label: '2026-08 CSV取込前',
        }));
        expect(mocks.save.mutateAsync).toHaveBeenCalledWith([expect.objectContaining({
            date: '2026-08-01', staffId: 's1', classType: 'c1', duty_number: 1,
        })]);
        expect(mocks.toastSuccess).toHaveBeenCalledWith('1件のシフトを取り込みました');
        expect(props.onImported).toHaveBeenCalledOnce();
        expect(props.onClose).toHaveBeenCalledOnce();
    });

    it('上書きモードでは固定日を渡して置換する', async () => {
        const { input } = renderModal({ fixedDates: new Set(['2026-08-10']) });
        fireEvent.click(screen.getByRole('button', { name: '上書き' }));
        fireEvent.change(input, { target: { files: [makeFile('shifts.CSV', csv)] } });
        await screen.findByText('1件を読み込み済み / 取込 1件 / スキップ 0件');
        fireEvent.click(screen.getByRole('button', { name: '取り込む' }));

        await waitFor(() => expect(mocks.replace.mutateAsync).toHaveBeenCalledWith({
            yearMonth: '2026-08',
            shifts: [expect.objectContaining({ staffId: 's1', classType: 'c1' })],
            fixedDates: ['2026-08-10'],
        }));
        expect(mocks.save.mutateAsync).not.toHaveBeenCalled();
    });

    it.each([
        [makeFile('shifts.txt', csv), 'CSVファイルを選択してください'],
        [makeFile('large.csv', csv, MAX_CSV_FILE_BYTES + 1), 'CSVファイルは2MB以下にしてください'],
        [makeFile('broken.csv', 'date,staffName,className,startTime,endTime\n"broken'), '引用符が閉じられていません'],
    ])('不正なファイルを取り込まずエラー表示する', async (file, message) => {
        const { input } = renderModal();
        fireEvent.change(input, { target: { files: [file] } });

        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(screen.getByRole('button', { name: '取り込む' })).toBeDisabled();
        expect(mocks.snapshot.mutateAsync).not.toHaveBeenCalled();
    });

    it('取込API失敗を共通エラー処理へ渡し、画面を閉じない', async () => {
        mocks.save.mutateAsync.mockRejectedValueOnce(new Error('failed'));
        const { input, props } = renderModal();
        fireEvent.change(input, { target: { files: [makeFile('shifts.csv', csv)] } });
        await screen.findByText('1件を読み込み済み / 取込 1件 / スキップ 0件');
        fireEvent.click(screen.getByRole('button', { name: '取り込む' }));

        await waitFor(() => expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), 'シフトの取り込みに失敗しました'));
        expect(props.onImported).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
    });
});
