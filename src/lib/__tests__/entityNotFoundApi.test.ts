import { describe, expect, it, vi } from 'vitest';
import { onRequestPut as updateClass } from '../../../functions/api/settings/classes/[id]';
import {
    onRequestDelete as deleteHoliday,
    onRequestPut as updateHoliday,
} from '../../../functions/api/settings/holidays/[id]';
import {
    onRequestDelete as deleteStaff,
    onRequestPut as updateStaff,
} from '../../../functions/api/staffs/[id]';

const missingRunDb = () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    return { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })), run };
};

const missingStaffDb = () => {
    const batch = vi.fn();
    const prepare = vi.fn(() => ({
        bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(null) })),
    }));
    return { DB: { prepare, batch }, batch };
};

describe('entity API not-found responses', () => {
    it('存在しないクラスの更新を404で返す', async () => {
        const db = missingRunDb();
        const response = await updateClass({
            params: { id: 'missing' },
            request: { json: async () => ({ name: 'クラスA' }) },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(404);
    });

    it('存在しない祝日の更新を404で返す', async () => {
        const db = missingRunDb();
        const response = await updateHoliday({
            params: { id: 'missing' },
            request: { json: async () => ({ name: '祝日' }) },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(404);
    });

    it('存在しない祝日の削除を404で返す', async () => {
        const db = missingRunDb();
        const response = await deleteHoliday({
            params: { id: 'missing' },
            env: { DB: db },
        } as never);

        expect(response.status).toBe(404);
    });

    it('存在しないスタッフの更新を404で返し、batchを実行しない', async () => {
        const db = missingStaffDb();
        const response = await updateStaff({
            request: {
                url: 'https://example.com/api/staffs/missing',
                json: async () => ({ name: 'スタッフA' }),
            },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(404);
        expect(db.batch).not.toHaveBeenCalled();
    });

    it('存在しないスタッフの削除を404で返し、batchを実行しない', async () => {
        const db = missingStaffDb();
        const response = await deleteStaff({
            request: { url: 'https://example.com/api/staffs/missing' },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(404);
        expect(db.batch).not.toHaveBeenCalled();
    });
});
