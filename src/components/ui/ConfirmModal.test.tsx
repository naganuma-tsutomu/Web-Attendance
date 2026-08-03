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

    it('副操作を選択できる', () => {
        const onSecondary = vi.fn();
        render(
            <ConfirmModal
                isOpen
                title="既存シフト"
                message="処理方法を選択してください"
                secondaryLabel="シフトも削除して保存"
                onSecondary={onSecondary}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'シフトも削除して保存' }));
        expect(onSecondary).toHaveBeenCalledOnce();
    });
});
