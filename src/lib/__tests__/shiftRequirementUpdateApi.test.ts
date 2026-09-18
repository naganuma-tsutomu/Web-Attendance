import { describe, expect, it, vi } from 'vitest';
import {
    onRequestDelete as deleteShiftRequirement,
    onRequestPut as updateShiftRequirement,
} from '../../../functions/api/settings/shift-requirements/[id]';

const currentRequirement = {
    id: 'req-1',
    classId: 'class-1',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '18:00',
    minStaffCount: 1,
    maxStaffCount: 3,
    priority: 1,
};

const createUpdateDb = (current: typeof currentRequirement | null) => {
    const updateRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const updateBind = vi.fn(() => ({ run: updateRun }));
    const prepare = vi.fn((sql: string) => {
        if (sql.includes('SELECT id, classId')) {
            return { bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(current) })) };
        }
        return { bind: updateBind };
    });
    return { DB: { prepare }, prepare, updateBind, updateRun };
};

describe('shift requirement update API', () => {
    it('既存の最大人数を超える最小人数への部分更新を拒否する', async () => {
        const db = createUpdateDb(currentRequirement);
        const response = await updateShiftRequirement({
            params: { id: 'req-1' },
            request: { json: async () => ({ minStaffCount: 4 }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(400);
        expect(db.updateRun).not.toHaveBeenCalled();
    });

    it('既存の開始時刻と同じ終了時刻への部分更新を拒否する', async () => {
        const db = createUpdateDb(currentRequirement);
        const response = await updateShiftRequirement({
            params: { id: 'req-1' },
            request: { json: async () => ({ endTime: '09:00' }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(400);
        expect(db.updateRun).not.toHaveBeenCalled();
    });

    it('検証済みの部分更新を保存する', async () => {
        const db = createUpdateDb(currentRequirement);
        const response = await updateShiftRequirement({
            params: { id: 'req-1' },
            request: { json: async () => ({ classId: ' class-2 ', minStaffCount: 2, maxStaffCount: null, priority: null }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(200);
        expect(db.updateBind).toHaveBeenCalledWith('class-2', 2, null, 0, 'req-1');
        expect(db.updateRun).toHaveBeenCalledTimes(1);
    });

    it('存在しない設定の更新を404で返す', async () => {
        const db = createUpdateDb(null);
        const response = await updateShiftRequirement({
            params: { id: 'missing' },
            request: { json: async () => ({ priority: 2 }) },
            env: { DB: db.DB },
        } as never);

        expect(response.status).toBe(404);
        expect(db.updateRun).not.toHaveBeenCalled();
    });

    it('存在しない設定の削除を404で返す', async () => {
        const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
        const response = await deleteShiftRequirement({
            params: { id: 'missing' },
            env: { DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) } },
        } as never);

        expect(response.status).toBe(404);
    });
});
