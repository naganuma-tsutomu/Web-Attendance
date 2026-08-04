import { describe, expect, it } from 'vitest';
import { ShiftPreferenceRequestSchema } from '../../../shared/shiftPreferenceSchema';
import { ShiftRequirementsRequestSchema } from '../../../shared/shiftRequirementSchema';

describe('preference and requirement request schemas', () => {
    it('対象月内の希望休を受け入れる', () => {
        expect(ShiftPreferenceRequestSchema.safeParse({
            staffId: 's1', yearMonth: '2026-08',
            details: [{ date: '2026-08-01', startTime: '09:00', endTime: '12:00' }],
        }).success).toBe(true);
    });

    it('対象月外または片方だけの時間指定を拒否する', () => {
        expect(ShiftPreferenceRequestSchema.safeParse({ staffId: 's1', yearMonth: '2026-08', details: [{ date: '2026-09-01' }] }).success).toBe(false);
        expect(ShiftPreferenceRequestSchema.safeParse({ staffId: 's1', yearMonth: '2026-08', details: [{ date: '2026-08-01', startTime: '09:00' }] }).success).toBe(false);
    });

    it('妥当な必要人数設定を受け入れる', () => {
        expect(ShiftRequirementsRequestSchema.safeParse({
            classId: 'c1', dayOfWeek: 7, startTime: '09:00', endTime: '18:00',
            minStaffCount: 1, maxStaffCount: 3, priority: 3,
        }).success).toBe(true);
    });

    it('最大人数が最小人数未満の設定を拒否する', () => {
        expect(ShiftRequirementsRequestSchema.safeParse({
            classId: 'c1', dayOfWeek: 7, startTime: '09:00', endTime: '18:00',
            minStaffCount: 3, maxStaffCount: 2,
        }).success).toBe(false);
    });
});
