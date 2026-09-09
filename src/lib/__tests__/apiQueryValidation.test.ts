import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as getHolidays } from '../../../functions/api/settings/holidays/index';
import { onRequestPost as syncHolidays } from '../../../functions/api/settings/holidays/sync';
import { onRequestGet as getShiftRequirements } from '../../../functions/api/settings/shift-requirements/index';

describe('API query validation', () => {
    it.each(['2026abc', '1999', '2101', ''])('祝日一覧の不正な年をDB処理前に拒否する: %s', async year => {
        const prepare = vi.fn();
        const response = await getHolidays({
            request: { url: `https://example.com/api/settings/holidays?year=${year}` },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
    });

    it.each(['abc', '1999', '2101', ''])('祝日同期の不正な年をDB処理前に拒否する: %s', async year => {
        const prepare = vi.fn();
        const response = await syncHolidays({
            request: { url: `https://example.com/api/settings/holidays/sync?year=${year}` },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
    });

    it('祝日同期はINSERTの変更件数から追加・スキップ件数を集計する', async () => {
        const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
        const prepare = vi.fn((sql: string) => ({ sql, bind: vi.fn(() => ({ run })) }));
        const response = await syncHolidays({
            request: { url: 'https://example.com/api/settings/holidays/sync?year=2026' },
            env: { DB: { prepare } },
        } as never);
        const result = await response.json() as { synced: number; skipped: number };

        expect(response.status).toBe(200);
        expect(result.synced).toBe(0);
        expect(result.skipped).toBeGreaterThan(0);
        expect(run).toHaveBeenCalledTimes(result.skipped);
        expect(prepare.mock.calls.every(([sql]) => String(sql).includes('INSERT OR IGNORE'))).toBe(true);
    });

    it.each(['abc', '1abc', '-1', '9', '1.5', ''])('必要人数一覧の不正な曜日をDB処理前に拒否する: %s', async dayOfWeek => {
        const prepare = vi.fn();
        const response = await getShiftRequirements({
            request: { url: `https://example.com/api/settings/shift-requirements?dayOfWeek=${dayOfWeek}` },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
    });

    it.each(['', ' '.repeat(2), 'a'.repeat(129)])('必要人数一覧の不正なクラスIDをDB処理前に拒否する', async classId => {
        const prepare = vi.fn();
        const response = await getShiftRequirements({
            request: { url: `https://example.com/api/settings/shift-requirements?classId=${encodeURIComponent(classId)}` },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
    });

    it('必要人数一覧のクラスIDを正規化し、検証済み曜日とともに検索する', async () => {
        const all = vi.fn().mockResolvedValue({ results: [] });
        const bind = vi.fn(() => ({ all }));
        const prepare = vi.fn(() => ({ bind }));
        const response = await getShiftRequirements({
            request: { url: 'https://example.com/api/settings/shift-requirements?classId=%20class-1%20&dayOfWeek=7' },
            env: { DB: { prepare } },
        } as never);

        expect(response.status).toBe(200);
        expect(bind).toHaveBeenCalledWith('class-1', 7);
    });
});
