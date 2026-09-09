import { describe, expect, it } from 'vitest';
import { ClassCreateSchema, RoleCreateSchema, TimePatternCreateSchema, TimePatternUpdateSchema } from '../../../shared/settingsEntitySchemas';
import { ShiftRequirementUpdateSchema } from '../../../shared/shiftRequirementSchema';

describe('settings entity request schemas', () => {
    it('有効な設定入力を受け入れる', () => {
        expect(ClassCreateSchema.safeParse({ name: 'クラスA', auto_allocate: 1, color: '#818cf8' }).success).toBe(true);
        expect(RoleCreateSchema.safeParse({ name: '常勤', targetHours: 160, weeklyHoursTarget: 40, patternIds: ['p1'] }).success).toBe(true);
        expect(TimePatternCreateSchema.safeParse({ name: '早番', startTime: '08:00', endTime: '17:00', mon: 1 }).success).toBe(true);
    });

    it.each([
        [ClassCreateSchema, { name: 'A', auto_allocate: 2 }],
        [ClassCreateSchema, { name: 'A', color: 'red' }],
        [RoleCreateSchema, { name: 'A', weeklyHoursTarget: 169 }],
        [RoleCreateSchema, { name: 'A', patternIds: ['p1', 'p1'] }],
        [TimePatternCreateSchema, { name: 'A', startTime: '8:00', endTime: '17:00' }],
        [TimePatternCreateSchema, { name: 'A', startTime: '08:00', endTime: '17:00', mon: 3 }],
        [TimePatternUpdateSchema, {}],
        [ShiftRequirementUpdateSchema, { id: 'req-1' }],
    ])('不正な設定入力を拒否する', (schema, value) => {
        expect(schema.safeParse(value).success).toBe(false);
    });
});
