import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
    it('チェックボックスの選択状態を確認処理へ渡す', () => {
        const onConfirm = vi.fn();
        render(
            <ConfirmModal
                isOpen
                title="シフトの消去"
                message="シフトを削除します"
                checkboxLabel="ロック済みのシフトも削除する"
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('checkbox', { name: 'ロック済みのシフトも削除する' }));
        fireEvent.click(screen.getByRole('button', { name: '実行' }));

        expect(onConfirm).toHaveBeenCalledWith(true);
    });
});
