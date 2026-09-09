import { describe, expect, it } from 'vitest';
import { StaffCreateInputSchema, StaffUpdateInputSchema } from '../../../shared/staffSchemas';

describe('staff API input schemas', () => {
    it('有効な作成入力を受け入れ、文字列の前後空白を除去する', () => {
        const result = StaffCreateInputSchema.parse({
            name: '  山田 ',
            role: ' パート ',
            hoursTarget: 100,
            weeklyHoursTarget: 25,
            defaultWorkingHoursStart: '09:00',
            defaultWorkingHoursEnd: '18:00',
            accessKey: '123456',
            availableDays: [{ day: 1, weeks: [1, 3, 5] }],
            classIds: ['class-a'],
        });

        expect(result.name).toBe('山田');
        expect(result.role).toBe('パート');
    });

    it.each([
        { field: 'hoursTarget', value: -1 },
        { field: 'weeklyHoursTarget', value: 169 },
        { field: 'defaultWorkingHoursStart', value: '25:00' },
        { field: 'accessKey', value: '1234' },
        { field: 'availableDays', value: [{ day: 7 }] },
        { field: 'availableDays', value: [{ day: 1, weeks: [0] }] },
        { field: 'classIds', value: ['class-a', 'class-a'] },
    ])('$field の不正値を拒否する', ({ field, value }) => {
        const result = StaffCreateInputSchema.safeParse({ name: '山田', role: 'パート', [field]: value });
        expect(result.success).toBe(false);
    });

    it('更新入力の未知フィールドを拒否する', () => {
        expect(StaffUpdateInputSchema.safeParse({ admin: true }).success).toBe(false);
    });

    it('空の更新入力を拒否する', () => {
        expect(StaffUpdateInputSchema.safeParse({}).success).toBe(false);
    });
});
