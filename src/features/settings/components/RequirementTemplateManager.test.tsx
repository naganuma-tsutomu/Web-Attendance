import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RequirementTemplateManager from './RequirementTemplateManager';

const renderManager = (hasUnsavedChanges: boolean) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <RequirementTemplateManager hasUnsavedChanges={hasUnsavedChanges} />
        </QueryClientProvider>
    );
};

describe('RequirementTemplateManager', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('未保存変更がある場合は保存を無効化し、呼び出し前に破棄警告を表示する', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify([
                {
                    id: 'template-1',
                    name: '夏休み',
                    itemCount: 4,
                    createdAt: '2026-07-01 00:00:00',
                    updatedAt: '2026-07-01 00:00:00',
                },
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
        ));

        renderManager(true);

        const saveButton = screen.getByRole('button', { name: '現在の設定を保存' });
        expect(saveButton).toBeDisabled();
        expect(screen.getByText(/先に「必要人数を保存」してください/)).toBeInTheDocument();

        await waitFor(() => expect(screen.getByRole('option', { name: '夏休み（4件）' })).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: '呼び出す' }));

        expect(screen.getByText(/未保存の変更は破棄されます/)).toBeInTheDocument();
    });
});
