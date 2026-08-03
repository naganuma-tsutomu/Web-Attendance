import { describe, expect, it } from 'vitest';
import { analyzeSchedule } from '../scheduleAnalysis';
import type { ScheduleAnalysisInput } from '../scheduleAnalysis';

const baseInput = (): ScheduleAnalysisInput => ({
    yearMonth: '2026-08',
    shifts: [],
    staffs: [{ id: 's1', name: '田中', role: 'r1', hoursTarget: 8, weeklyHoursTarget: 40, classIds: ['c1'], availableDays: [0, 1, 2, 3, 4, 5, 6] }],
    classes: [{ id: 'c1', name: '受付', display_order: 0, auto_allocate: 1 }],
    preferences: [],
    requirements: [],
    holidays: [],
    businessDayOverrides: [],
    businessHours: { startHour: 9, endHour: 18, closedDays: [0] },
});

describe('analyzeSchedule', () => {
    it('希望休との競合と目標時間超過を検出する', () => {
        const input = baseInput();
        input.shifts = [{ id: 'shift1', date: '2026-08-03', staffId: 's1', classType: 'c1', startTime: '08:00', endTime: '18:00' }];
        input.preferences = [{ id: 'p1', staffId: 's1', yearMonth: '2026-08', submitted: true, details: [{ date: '2026-08-03', startTime: '08:00', endTime: '10:00' }] }];
        const result = analyzeSchedule(input);
        expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['PARTIAL_PREFERENCE_CONFLICT', 'OUTSIDE_BUSINESS_HOURS', 'MONTHLY_HOURS_EXCEEDED']));
        expect(result.summary.submittedCount).toBe(1);
    });

    it('個別休業日に残るシフトを検出する', () => {
        const input = baseInput();
        input.shifts = [{ id: 'shift1', date: '2026-08-04', staffId: 's1', classType: 'c1', startTime: '09:00', endTime: '17:00' }];
        input.businessDayOverrides = [{ id: 'o1', date: '2026-08-04', status: 'closed', name: '臨時休業' }];
        expect(analyzeSchedule(input).issues.some(issue => issue.code === 'CLOSED_DAY_SHIFT')).toBe(true);
    });

    it('必要人数の15分スロットを集計する', () => {
        const input = baseInput();
        input.requirements = [{ id: 'req1', classId: 'c1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', minStaffCount: 1, priority: 1 }];
        input.shifts = [{ id: 'shift1', date: '2026-08-03', staffId: 's1', classType: 'c1', startTime: '09:00', endTime: '09:30' }];
        const result = analyzeSchedule(input);
        expect(result.classMetrics[0]).toMatchObject({ requiredSlots: 20, filledSlots: 2, shortageSlots: 18 });
        const shortages = result.issues.filter(issue => issue.code === 'REQUIREMENT_SHORTAGE');
        expect(shortages).toHaveLength(5);
        expect(shortages.find(issue => issue.date === '2026-08-03')).toMatchObject({ startTime: '09:30', endTime: '10:00' });
    });
});
