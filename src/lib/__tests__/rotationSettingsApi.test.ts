import { describe, expect, it, vi } from 'vitest';
import { onRequestPut as updateRotationSettings } from '../../../functions/api/settings/rotation-settings';

const validSettings = {
    enabled: true,
    roleId: 'role1',
    earlyPatternId: 'early',
    latePatternId: 'late',
    weekdayEarlyCount: 1,
    weekdayLateCount: 2,
    saturdayEnabled: true,
    saturdayCount: 1,
    saturdayPreferFridayLate: true,
    saturdayPatternId: 'saturday',
};

const createContext = (body: unknown, run = vi.fn().mockResolvedValue({ success: true })) => {
    const statement = {
        bind: vi.fn(() => ({ run })),
    };
    return {
        context: {
            request: { json: async () => body },
            env: { DB: { prepare: vi.fn(() => statement) } },
        },
        run,
    };
};

describe('rotation settings API', () => {
    it('正常な設定を保存する', async () => {
        const { context, run } = createContext(validSettings);

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(200);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('0人設定を許可する', async () => {
        const { context, run } = createContext({
            ...validSettings,
            weekdayEarlyCount: 0,
            weekdayLateCount: 0,
            saturdayCount: 0,
        });

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(200);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('負数・小数・上限超過の人数を拒否する', async () => {
        for (const invalidCount of [-1, 1.5, 101]) {
            const { context, run } = createContext({
                ...validSettings,
                weekdayEarlyCount: invalidCount,
            });

            const response = await updateRotationSettings(context as never);

            expect(response.status).toBe(400);
            expect(run).not.toHaveBeenCalled();
        }
    });

    it('同じ早番・遅番パターンを拒否する', async () => {
        const { context, run } = createContext({
            ...validSettings,
            latePatternId: validSettings.earlyPatternId,
        });

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(400);
        expect(run).not.toHaveBeenCalled();
    });

    it('土曜有効時に土曜パターンがなければ拒否する', async () => {
        const { context, run } = createContext({
            ...validSettings,
            saturdayPatternId: undefined,
        });

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(400);
        expect(run).not.toHaveBeenCalled();
    });
});
