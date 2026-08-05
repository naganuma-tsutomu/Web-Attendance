import { describe, expect, it } from 'vitest';
import { ShiftBatchCreateSchema, ShiftClearSchema, ShiftReplaceSchema, ShiftUpdateSchema } from '../../../shared/shiftRequestSchemas';

const shift = { date: '2026-08-01', staffId: 's1', classType: 'c1', startTime: '09:00', endTime: '18:00' };

describe('shift request schemas', () => {
    it('有効なシフト入力を受け入れる', () => {
        expect(ShiftBatchCreateSchema.safeParse([shift]).success).toBe(true);
        expect(ShiftUpdateSchema.safeParse({ startTime: '10:00', duty_number: 1 }).success).toBe(true);
    });

    it.each([
        [{ ...shift, date: '2026-02-30' }],
        [{ ...shift, startTime: '9:00' }],
        [{ ...shift, startTime: '09:00', endTime: '09:00' }],
        [{ ...shift, duty_number: 0 }],
        [{ ...shift, unexpected: true }],
    ])('不正なシフト入力を拒否する', (input) => {
        expect(ShiftBatchCreateSchema.safeParse(input).success).toBe(false);
    });

    it('月次置換では対象月外のシフトと固定日を拒否する', () => {
        expect(ShiftReplaceSchema.safeParse({ yearMonth: '2026-08', expectedVersion: 0, shifts: [shift], fixedDates: ['2026-08-01'] }).success).toBe(true);
        expect(ShiftReplaceSchema.safeParse({ yearMonth: '2026-08', expectedVersion: 0, shifts: [{ ...shift, date: '2026-09-01' }] }).success).toBe(false);
        expect(ShiftReplaceSchema.safeParse({ yearMonth: '2026-08', shifts: [shift] }).success).toBe(false);
    });

    it('消去除外日は対象月内かつ重複なしに限定する', () => {
        expect(ShiftClearSchema.safeParse({ yearMonth: '2026-08', exceptDates: ['2026-08-01'] }).success).toBe(true);
        expect(ShiftClearSchema.safeParse({ yearMonth: '2026-08', exceptDates: ['2026-08-01', '2026-08-01'] }).success).toBe(false);
    });
});
