import { afterEach, describe, expect, it, vi } from 'vitest';
import { getScheduleBootstrap } from '../api/scheduleBootstrapApi';

const createResponse = (months: string[]) => ({
    references: {
        staffs: [],
        classes: [],
        timePatterns: [],
        roles: [],
        businessHours: { startHour: 8, endHour: 19, closedDays: [0] },
        excelSettings: { excludeHolidayStaffOnSaturdays: true, highlightRules: [], showDutyNumbers: false, leaderRoleId: null },
        breakSettings: {
            exceptionEnabled: false,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 30,
            displayActualHoursInModal: false,
            displayActualHoursInExcel: false,
        },
        schedulePreferences: { autoOpenGenerationReport: true },
        shiftRequirements: [],
    },
    months: Object.fromEntries(months.map(month => [month, {
        shifts: { shifts: [], version: 0 },
        preferences: [],
        fixedDates: [],
        businessDayOverrides: [],
    }])),
    holidays: { '2026': [] },
});

describe('schedule bootstrap API client', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('複数月を繰り返しクエリとして送る', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createResponse(['2026-08', '2026-09']))));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getScheduleBootstrap(['2026-08', '2026-09'])).resolves.toBeDefined();
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/schedule-bootstrap?month=2026-08&month=2026-09',
            expect.any(Object),
        );
    });

    it('要求した月がレスポンスに欠けていれば空データとして扱わない', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createResponse(['2026-08']))));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getScheduleBootstrap(['2026-08', '2026-09']))
            .rejects.toThrow('2026-09のスケジュールデータが不足しています');
    });
});
