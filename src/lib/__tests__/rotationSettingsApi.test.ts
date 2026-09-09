import { describe, expect, it, vi } from 'vitest';
import { onRequestPut as updateRotationSettings } from '../../../functions/api/settings/rotation-settings';
import { RotationSettingsSchema } from '../../../shared/appSettingsSchemas';

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
    const bind = vi.fn((value: string) => ({ run, value }));
    const prepare = vi.fn(() => ({ bind }));
    return {
        context: {
            request: { json: async () => body },
            env: { DB: { prepare } },
        },
        bind,
        prepare,
        run,
    };
};

describe('rotation settings API', () => {
    it('正常な設定を保存する', async () => {
        const { context, bind, run } = createContext(validSettings);

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(200);
        expect(run).toHaveBeenCalledTimes(1);
        expect(JSON.parse(bind.mock.calls[0][0])).toEqual(validSettings);
    });

    it('取得用スキーマの既定値をAPIと同じ内容で補完する', () => {
        expect(RotationSettingsSchema.parse({})).toEqual({
            enabled: false,
            roleId: '',
            earlyPatternId: '',
            latePatternId: '',
            weekdayEarlyCount: 1,
            weekdayLateCount: 2,
            saturdayEnabled: true,
            saturdayCount: 1,
            saturdayPreferFridayLate: true,
        });
    });

    it('識別子の前後空白を除去して保存する', async () => {
        const { context, bind } = createContext({
            ...validSettings,
            roleId: ' role1 ',
            earlyPatternId: ' early ',
            latePatternId: ' late ',
            saturdayPatternId: ' saturday ',
        });

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(200);
        expect(JSON.parse(bind.mock.calls[0][0])).toMatchObject({
            roleId: 'role1',
            earlyPatternId: 'early',
            latePatternId: 'late',
            saturdayPatternId: 'saturday',
        });
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

    it('無効時はパターン未選択でも保存できる', async () => {
        const { context, run } = createContext({
            ...validSettings,
            enabled: false,
            roleId: '',
            earlyPatternId: '',
            latePatternId: '',
            saturdayPatternId: undefined,
        });

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(200);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it.each([
        null,
        [],
        { ...validSettings, enabled: 1 },
        { ...validSettings, roleId: 'a'.repeat(201) },
        { ...validSettings, unexpected: true },
        { enabled: true },
    ])('型違い・上限超過・未知フィールド・部分入力を拒否する', async body => {
        const { context, prepare, run } = createContext(body);

        const response = await updateRotationSettings(context as never);

        expect(response.status).toBe(400);
        expect(prepare).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
    });
});
