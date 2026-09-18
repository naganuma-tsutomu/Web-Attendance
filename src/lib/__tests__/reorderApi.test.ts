import { describe, expect, it, vi } from 'vitest';
import { onRequestPut as reorderStaffs } from '../../../functions/api/staffs/reorder';
import { onRequestPut as reorderClasses } from '../../../functions/api/settings/classes/reorder';
import { onRequestPut as reorderRoles } from '../../../functions/api/settings/roles/reorder';
import { onRequestPut as reorderTimePatterns } from '../../../functions/api/settings/time-patterns/reorder';

const handlers = [
    ['スタッフ', reorderStaffs],
    ['クラス', reorderClasses],
    ['スタッフ区分', reorderRoles],
    ['勤務時間パターン', reorderTimePatterns],
] as const;

describe('reorder APIs', () => {
    it.each(handlers)('%sの0始まり表示順を保存する', async (_name, handler) => {
        const batch = vi.fn().mockResolvedValue([]);
        const bind = vi.fn((...values: unknown[]) => ({ values }));
        const response = await handler({
            request: { json: async () => ({ orders: [{ id: 'item-1', order: 0 }] }) },
            env: { DB: { prepare: vi.fn(() => ({ bind })), batch } },
        } as never);

        expect(response.status).toBe(200);
        expect(bind).toHaveBeenCalledWith(0, 'item-1');
        expect(batch).toHaveBeenCalledTimes(1);
    });

    it.each(handlers)('%sの空の並び替えをDB処理なしで成功扱いにする', async (_name, handler) => {
        const prepare = vi.fn();
        const batch = vi.fn();
        const response = await handler({
            request: { json: async () => ({ orders: [] }) },
            env: { DB: { prepare, batch } },
        } as never);

        expect(response.status).toBe(200);
        expect(prepare).not.toHaveBeenCalled();
        expect(batch).not.toHaveBeenCalled();
    });
});
