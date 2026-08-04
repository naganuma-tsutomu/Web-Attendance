import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Modal from '../../components/ui/Modal';
import StaffLoginPage from '../../pages/StaffLoginPage';

const expectNoSeriousViolations = async (container: HTMLElement) => {
    const result = await axe.run(container, {
        resultTypes: ['violations'],
        rules: {
            // happy-dom does not perform layout/color calculations reliably.
            'color-contrast': { enabled: false },
        },
    });
    const violations = result.violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
    expect(violations, violations.map(item => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
};

describe('accessibility smoke tests', () => {
    afterEach(() => vi.restoreAllMocks());

    it('スタッフログイン画面に重大なaxe違反がない', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify([{ id: 's1', name: '山田' }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        ));
        const { container, getByRole } = render(
            <MemoryRouter>
                <StaffLoginPage />
            </MemoryRouter>
        );
        await waitFor(() => expect(getByRole('option', { name: '山田' })).toBeInTheDocument());
        await expectNoSeriousViolations(container);
    });

    it('共通モーダルに読み上げ名があり、重大なaxe違反がない', async () => {
        const { container } = render(
            <Modal isOpen onClose={() => {}} aria-label="確認">
                <button type="button">閉じる</button>
            </Modal>
        );
        await expectNoSeriousViolations(container);
    });
});
