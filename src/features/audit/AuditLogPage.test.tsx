import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditLogPage from './AuditLogPage';

const mocks = vi.hoisted(() => ({ fetchNextPage: vi.fn() }));

vi.mock('../../lib/hooks', () => ({
    useAuditLogs: () => ({
        data: {
            pages: [
                {
                    items: [{
                        id: 'audit-1', occurredAt: '2026-09-09 10:00:00', actorType: 'admin', actorId: null,
                        action: 'update', entityType: 'shift', entityId: null, yearMonth: '2026-09',
                        targetDate: null, summary: '1ページ目の操作', before: null, after: null,
                        metadata: null, requestId: null,
                    }],
                    nextCursor: '["2026-09-09 10:00:00","audit-1"]',
                },
                {
                    items: [{
                        id: 'audit-2', occurredAt: '2026-09-09 09:00:00', actorType: 'staff', actorId: 'staff-1',
                        action: 'create', entityType: 'preference', entityId: null, yearMonth: '2026-09',
                        targetDate: null, summary: '2ページ目の操作', before: null, after: null,
                        metadata: null, requestId: null,
                    }],
                    nextCursor: null,
                },
            ],
        },
        fetchNextPage: mocks.fetchNextPage,
        hasNextPage: true,
        isError: false,
        isFetchingNextPage: false,
        isLoading: false,
    }),
}));

describe('AuditLogPage', () => {
    beforeEach(() => {
        mocks.fetchNextPage.mockReset();
    });

    it('取得済みの全ページを表示し、次ページを読み込める', () => {
        render(<AuditLogPage />);

        expect(screen.getByText('1ページ目の操作')).toBeInTheDocument();
        expect(screen.getByText('2ページ目の操作')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'さらに読み込む' }));
        expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
    });
});
