import { describe, expect, it } from 'vitest';
import { AdminLoginSchema, FacilityUpdateSchema, RequirementTemplateNameSchema, StaffLoginSchema } from '../../../shared/basicRequestSchemas';

describe('basic request schemas', () => {
    it('有効な認証・名称入力を受け入れる', () => {
        expect(AdminLoginSchema.safeParse({ password: 'secret' }).success).toBe(true);
        expect(StaffLoginSchema.safeParse({ name: '山田', accessKey: '123456' }).success).toBe(true);
        expect(FacilityUpdateSchema.safeParse({ name: '施設A' }).success).toBe(true);
        expect(RequirementTemplateNameSchema.safeParse({ name: '平日標準' }).success).toBe(true);
    });

    it.each([
        [StaffLoginSchema, { name: '山田', accessKey: '1234' }],
        [StaffLoginSchema, { name: '', accessKey: '123456' }],
        [FacilityUpdateSchema, { name: ' ' }],
        [RequirementTemplateNameSchema, { name: 'a'.repeat(51) }],
        [AdminLoginSchema, { password: 'x', extra: true }],
    ])('不正な入力を拒否する', (schema, input) => {
        expect(schema.safeParse(input).success).toBe(false);
    });
});
