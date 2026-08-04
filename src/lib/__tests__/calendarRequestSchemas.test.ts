import { describe, expect, it } from 'vitest';
import {
    BusinessDayOverrideBulkSchema, DateSchema, FixedDatesReplaceSchema,
    HolidayCreateSchema,
} from '../../../shared/calendarRequestSchemas';

describe('calendar request schemas', () => {
    it('実在する日付だけを受け入れる', () => {
        expect(DateSchema.safeParse('2028-02-29').success).toBe(true);
        expect(DateSchema.safeParse('2026-02-29').success).toBe(false);
    });

    it('祝日の種別と未知フィールドを検証する', () => {
        expect(HolidayCreateSchema.safeParse({ date: '2026-08-11', name: '山の日', type: 'national' }).success).toBe(true);
        expect(HolidayCreateSchema.safeParse({ date: '2026-08-11', name: '休日', type: 'other' }).success).toBe(false);
    });

    it('一括営業日設定の期間順序を検証する', () => {
        expect(BusinessDayOverrideBulkSchema.safeParse({ startDate: '2026-08-10', endDate: '2026-08-01', status: 'open' }).success).toBe(false);
    });

    it('固定日は対象月内かつ重複なしに限定する', () => {
        expect(FixedDatesReplaceSchema.safeParse({ yearMonth: '2026-08', dates: ['2026-08-01'] }).success).toBe(true);
        expect(FixedDatesReplaceSchema.safeParse({ yearMonth: '2026-08', dates: ['2026-09-01'] }).success).toBe(false);
        expect(FixedDatesReplaceSchema.safeParse({ yearMonth: '2026-08', dates: ['2026-08-01', '2026-08-01'] }).success).toBe(false);
    });
});
