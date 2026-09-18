import { afterEach, describe, expect, it, vi } from 'vitest';
import { syncHolidays } from '../api/holidayApi';

describe('holiday API client', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('祝日同期を状態変更用のPOSTで送信する', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, message: '同期完了', synced: 1, skipped: 0 }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await syncHolidays(2026);

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/settings/holidays/sync?year=2026',
            expect.objectContaining({ method: 'POST', body: '{}' }),
        );
    });
});
