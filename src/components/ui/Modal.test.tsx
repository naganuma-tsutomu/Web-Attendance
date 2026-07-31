import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
    it('keeps the current focus when its parent rerenders with a new onClose callback', () => {
        const { rerender } = render(
            <Modal isOpen onClose={() => undefined}>
                <button type="button">閉じる</button>
                <input aria-label="氏名" value="" onChange={() => undefined} />
            </Modal>
        );

        const input = screen.getByRole('textbox', { name: '氏名' });
        input.focus();
        fireEvent.change(input, { target: { value: '山' } });

        rerender(
            <Modal isOpen onClose={() => undefined}>
                <button type="button">閉じる</button>
                <input aria-label="氏名" value="山" onChange={vi.fn()} />
            </Modal>
        );

        expect(input).toHaveFocus();
    });

    it('uses the latest onClose callback for the Escape key', () => {
        const firstOnClose = vi.fn();
        const latestOnClose = vi.fn();
        const { rerender } = render(
            <Modal isOpen onClose={firstOnClose}>
                <button type="button">閉じる</button>
            </Modal>
        );

        rerender(
            <Modal isOpen onClose={latestOnClose}>
                <button type="button">閉じる</button>
            </Modal>
        );
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(firstOnClose).not.toHaveBeenCalled();
        expect(latestOnClose).toHaveBeenCalledOnce();
    });
});
