import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as getBreakSettings, onRequestPut as updateBreakSettings } from '../../../functions/api/settings/break-rules';
import { onRequestGet as getBusinessHours, onRequestPut as updateBusinessHours } from '../../../functions/api/settings/business-hours';
import { onRequestGet as getExcelSettings, onRequestPut as updateExcelSettings } from '../../../functions/api/settings/excel-settings';
import { onRequestGet as getSchedulePreferences, onRequestPut as updateSchedulePreferences } from '../../../functions/api/settings/schedule-preferences';

const createSingleStatementContext = (body: unknown) => {
    const run = vi.fn().mockResolvedValue({ success: true });
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

describe('app settings APIs', () => {
    const getContext = (results: Array<{ key?: string; value: string }>) => ({
        env: {
            DB: {
                prepare: vi.fn(() => ({
                    all: vi.fn().mockResolvedValue({ results }),
                })),
            },
        },
    });

    describe('business hours', () => {
        it('保存値が不正なら既定の営業時間へ戻す', async () => {
            const response = await getBusinessHours(getContext([
                { key: 'business_hours_start', value: 'NaN' },
                { key: 'business_hours_end', value: '19' },
                { key: 'business_hours_closed_days', value: '{broken' },
            ]) as never);

            expect(await response.json()).toEqual({ startHour: 8, endHour: 19, closedDays: [0] });
        });

        it('検証済みの営業時間を同じbatchで保存する', async () => {
            const statements = [{ id: 1 }, { id: 2 }, { id: 3 }];
            const prepare = vi.fn()
                .mockReturnValueOnce({ bind: vi.fn(() => statements[0]) })
                .mockReturnValueOnce({ bind: vi.fn(() => statements[1]) })
                .mockReturnValueOnce({ bind: vi.fn(() => statements[2]) });
            const batch = vi.fn().mockResolvedValue([]);
            const response = await updateBusinessHours({
                request: { json: async () => ({ startHour: 8.5, endHour: 18, closedDays: [0, 7] }) },
                env: { DB: { prepare, batch } },
            } as never);

            expect(response.status).toBe(200);
            expect(batch).toHaveBeenCalledWith(statements);
        });

        it.each([
            { startHour: 8.25, endHour: 18, closedDays: [0] },
            { startHour: 18, endHour: 18, closedDays: [0] },
            { startHour: 17, endHour: 18, closedDays: [0] },
            { startHour: 8, endHour: 18, closedDays: [8] },
            { startHour: 8, endHour: 18, closedDays: [0, 0] },
            { startHour: 8, endHour: 18, closedDays: [0], unexpected: true },
        ])('不正な営業時間をDB処理前に拒否する', async body => {
            const prepare = vi.fn();
            const batch = vi.fn();
            const response = await updateBusinessHours({
                request: { json: async () => body },
                env: { DB: { prepare, batch } },
            } as never);

            expect(response.status).toBe(400);
            expect(prepare).not.toHaveBeenCalled();
            expect(batch).not.toHaveBeenCalled();
        });
    });

    describe('break settings', () => {
        it('部分的な保存値を検証して既定値を補完する', async () => {
            const response = await getBreakSettings(getContext([
                { value: JSON.stringify({ exceptionEnabled: true }) },
            ]) as never);

            expect(await response.json()).toEqual({
                exceptionEnabled: true,
                exceptionThresholdTime: '12:00',
                exceptionBreakMinutes: 30,
                displayActualHoursInModal: false,
                displayActualHoursInExcel: false,
            });
        });

        it('省略項目を既定値で補完して保存する', async () => {
            const { context, bind, run } = createSingleStatementContext({ exceptionEnabled: true });
            const response = await updateBreakSettings(context as never);

            expect(response.status).toBe(200);
            expect(run).toHaveBeenCalledTimes(1);
            expect(JSON.parse(bind.mock.calls[0][0])).toEqual({
                exceptionEnabled: true,
                exceptionThresholdTime: '12:00',
                exceptionBreakMinutes: 30,
                displayActualHoursInModal: false,
                displayActualHoursInExcel: false,
            });
        });

        it.each([
            { exceptionThresholdTime: '8:00' },
            { exceptionBreakMinutes: -1 },
            { exceptionBreakMinutes: 121 },
            { exceptionEnabled: 'true' },
            { unexpected: true },
        ])('不正な休憩設定を保存しない', async body => {
            const { context, prepare, run } = createSingleStatementContext(body);
            const response = await updateBreakSettings(context as never);

            expect(response.status).toBe(400);
            expect(prepare).not.toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
        });
    });

    describe('Excel settings', () => {
        it('壊れた保存値なら完全な既定値を返す', async () => {
            const response = await getExcelSettings(getContext([
                { value: JSON.stringify({ showDutyNumbers: 'yes' }) },
            ]) as never);

            expect(await response.json()).toEqual({
                excludeHolidayStaffOnSaturdays: true,
                highlightRules: [],
                showDutyNumbers: false,
                leaderRoleId: null,
            });
        });

        it('検証・補完したExcel設定を保存する', async () => {
            const { context, bind, run } = createSingleStatementContext({
                highlightRules: [{
                    staffId: 'staff-1',
                    regularStartTime: '08:00',
                    regularEndTime: '17:00',
                }],
            });
            const response = await updateExcelSettings(context as never);

            expect(response.status).toBe(200);
            expect(run).toHaveBeenCalledTimes(1);
            expect(JSON.parse(bind.mock.calls[0][0])).toEqual({
                excludeHolidayStaffOnSaturdays: true,
                highlightRules: [{
                    staffId: 'staff-1',
                    regularStartTime: '08:00',
                    regularEndTime: '17:00',
                    highlightColor: 'FFFFCCE5',
                }],
                showDutyNumbers: false,
                leaderRoleId: null,
            });
        });

        it.each([
            { highlightRules: [{ staffId: '', regularStartTime: '08:00', regularEndTime: '17:00' }] },
            { highlightRules: [{ staffId: 'staff-1', regularStartTime: '8:00', regularEndTime: '17:00' }] },
            { highlightRules: [{ staffId: 'staff-1', regularStartTime: '08:00', regularEndTime: '17:00', highlightColor: '#ff0000' }] },
            { showDutyNumbers: 1 },
            { unexpected: true },
        ])('不正なExcel設定を保存しない', async body => {
            const { context, prepare, run } = createSingleStatementContext(body);
            const response = await updateExcelSettings(context as never);

            expect(response.status).toBe(400);
            expect(prepare).not.toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
        });
    });

    describe('schedule preferences', () => {
        it('壊れたJSONなら既定値を返す', async () => {
            const response = await getSchedulePreferences(getContext([
                { value: '{broken' },
            ]) as never);

            expect(await response.json()).toEqual({ autoOpenGenerationReport: true });
        });

        it('真偽値をそのまま保存する', async () => {
            const { context, bind, run } = createSingleStatementContext({ autoOpenGenerationReport: false });
            const response = await updateSchedulePreferences(context as never);

            expect(response.status).toBe(200);
            expect(run).toHaveBeenCalledTimes(1);
            expect(JSON.parse(bind.mock.calls[0][0])).toEqual({ autoOpenGenerationReport: false });
        });

        it.each([
            { autoOpenGenerationReport: 'false' },
            { autoOpenGenerationReport: 0 },
            { unexpected: true },
        ])('真偽値以外や未知フィールドを保存しない', async body => {
            const { context, prepare, run } = createSingleStatementContext(body);
            const response = await updateSchedulePreferences(context as never);

            expect(response.status).toBe(400);
            expect(prepare).not.toHaveBeenCalled();
            expect(run).not.toHaveBeenCalled();
        });
    });
});
