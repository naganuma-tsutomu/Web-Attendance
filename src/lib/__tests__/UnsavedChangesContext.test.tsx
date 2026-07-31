import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider, useUnsavedChanges } from '../UnsavedChangesContext';

const Probe = ({
    dirty,
    save,
    discard,
    transition,
}: {
    dirty: boolean;
    save: () => Promise<void>;
    discard: () => void;
    transition: () => void;
}) => {
    const { setGuard, requestTransition } = useUnsavedChanges();
    useEffect(() => {
        setGuard({ dirty, save, discard });
        return () => setGuard(null);
    }, [dirty, discard, save, setGuard]);
    return <button onClick={() => requestTransition(transition)}>移動</button>;
};

describe('UnsavedChangesProvider', () => {
    it('未保存時は遷移を保留し、破棄後に実行する', () => {
        const discard = vi.fn();
        const transition = vi.fn();
        render(
            <UnsavedChangesProvider>
                <Probe dirty save={vi.fn()} discard={discard} transition={transition} />
            </UnsavedChangesProvider>
        );

        fireEvent.click(screen.getByText('移動'));
        expect(transition).not.toHaveBeenCalled();
        expect(screen.getByText('未保存の変更があります')).toBeInTheDocument();

        fireEvent.click(screen.getByText('破棄して移動'));
        expect(discard).toHaveBeenCalledOnce();
        expect(transition).toHaveBeenCalledOnce();
    });

    it('未編集時は確認なしで遷移する', () => {
        const transition = vi.fn();
        render(
            <UnsavedChangesProvider>
                <Probe dirty={false} save={vi.fn()} discard={vi.fn()} transition={transition} />
            </UnsavedChangesProvider>
        );

        fireEvent.click(screen.getByText('移動'));
        expect(transition).toHaveBeenCalledOnce();
        expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
    });
});
