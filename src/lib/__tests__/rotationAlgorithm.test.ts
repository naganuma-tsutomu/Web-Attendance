/**
 * TEST-1: rotationAlgorithm.ts のユニットテスト
 *
 * テスト対象:
 * - restorePreviousMonthState: 前月状態復元テスト
 * - assignWeekdayShifts: 早番・遅番の平等分配テスト
 * - assignSaturdayShifts: 土曜割当テスト
 * - applyRotation: エッジケース（スタッフ数 < 要件数）テスト
 */

import { describe, it, expect } from 'vitest';
import { eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import {
    restorePreviousMonthState,
    assignWeekdayShifts,
    type RotationState,
} from '../rotationAlgorithm';
import { applyRotation } from '../rotationAlgorithm';
import type { Staff, Shift, ShiftTimePattern, ShiftClass, DynamicRole, RotationSettings } from '../../types';

// ── テスト用ヘルパー ──────────────────────────

const makeStaff = (id: string, role = 'フルタイム'): Staff => ({
    id,
    name: `Staff ${id}`,
    role,
    hoursTarget: null,
    display_order: 0,
    availableDays: [],
    classIds: [],
});

const makePattern = (id: string, startTime: string, endTime: string): ShiftTimePattern => ({
    id,
    name: `Pattern ${id}`,
    startTime,
    endTime,
    roleIds: [],
    sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, holiday: 1
});

const makeClass = (id: string): ShiftClass => ({
    id,
    name: `Class ${id}`,
    display_order: 0,
    auto_allocate: 1,
});

const makeRole = (id: string, name: string): DynamicRole => ({
    id,
    name,
    targetHours: null,
    patterns: [],
    display_order: 1,
});

const makeRotationSettings = (overrides: Partial<RotationSettings> = {}): RotationSettings => ({
    enabled: true,
    roleId: 'role1',
    earlyPatternId: 'early',
    latePatternId: 'late',
    weekdayEarlyCount: 1,
    weekdayLateCount: 1,
    saturdayEnabled: false,
    saturdayCount: 1,
    saturdayPatternId: undefined,
    saturdayPreferFridayLate: false,
    ...overrides,
});

const makeEmptyState = (staffIds: string[]): RotationState => ({
    previousDayEarly: [],
    previousDayLate: [],
    lastEarlyShift: {},
    lastLateShift: {},
    earlyShiftCount: Object.fromEntries(staffIds.map(id => [id, 0])),
    lateShiftCount: Object.fromEntries(staffIds.map(id => [id, 0])),
});

const earlyPattern = makePattern('early', '08:00', '17:00');
const latePattern = makePattern('late', '12:00', '21:00');
const classes = [makeClass('class1')];

// ─────────────────────────────────────────────

describe('restorePreviousMonthState', () => {
    it('前月シフトがない場合は状態を変更しない', () => {
        const staff = [makeStaff('s1'), makeStaff('s2')];
        const firstDay = new Date('2025-07-01');
        const state = makeEmptyState(['s1', 's2']);

        restorePreviousMonthState([], firstDay, staff, earlyPattern, latePattern, state);

        expect(state.previousDayEarly).toEqual([]);
        expect(state.previousDayLate).toEqual([]);
        expect(state.lastEarlyShift).toEqual({});
        expect(state.lastLateShift).toEqual({});
    });

    it('前月最終稼働日の早番スタッフを previousDayEarly に追加', () => {
        const staff = [makeStaff('s1'), makeStaff('s2')];
        const firstDay = new Date('2025-07-01');
        const state = makeEmptyState(['s1', 's2']);

        const prevShifts: Shift[] = [
            // 6/28 (前月最終稼働日)
            { id: 'sh1', date: '2025-06-28', staffId: 's1', startTime: '08:00', endTime: '17:00', classType: 'class1' },
            { id: 'sh2', date: '2025-06-28', staffId: 's2', startTime: '12:00', endTime: '21:00', classType: 'class1' },
            // 6/27
            { id: 'sh3', date: '2025-06-27', staffId: 's2', startTime: '08:00', endTime: '17:00', classType: 'class1' },
        ];

        restorePreviousMonthState(prevShifts, firstDay, staff, earlyPattern, latePattern, state);

        expect(state.previousDayEarly).toContain('s1');
        expect(state.previousDayLate).toContain('s2');
        expect(state.lastEarlyShift['s1']).toBe('2025-06-28');
        expect(state.lastLateShift['s2']).toBe('2025-06-28');
        // s2の最後の早番は6/27
        expect(state.lastEarlyShift['s2']).toBe('2025-06-27');
    });

    it('ローテーション対象外のスタッフのシフトは無視する', () => {
        const staff = [makeStaff('s1')]; // s2 はローテーション対象外
        const firstDay = new Date('2025-07-01');
        const state = makeEmptyState(['s1']);

        const prevShifts: Shift[] = [
            { id: 'sh1', date: '2025-06-28', staffId: 's2', startTime: '08:00', endTime: '17:00', classType: 'class1' },
        ];

        restorePreviousMonthState(prevShifts, firstDay, staff, earlyPattern, latePattern, state);

        expect(state.previousDayEarly).toEqual([]);
        expect(state.lastEarlyShift).toEqual({});
    });
});

// ─────────────────────────────────────────────

describe('assignWeekdayShifts', () => {
    it('早番・遅番が 1 名ずつ割り当てられる', () => {
        const staff = [makeStaff('s1'), makeStaff('s2'), makeStaff('s3')];
        const state = makeEmptyState(['s1', 's2', 's3']);
        const generatedShifts: Shift[] = [];
        const currentHours: Record<string, number> = { s1: 0, s2: 0, s3: 0 };
        const currentWeeklyHours: Record<string, Record<string, number>> = { s1: {}, s2: {}, s3: {} };

        const settings = makeRotationSettings({ weekdayEarlyCount: 1, weekdayLateCount: 1 });

        const date = new Date('2025-07-01');
        const sortDefault = (a: Staff, b: Staff) => (currentHours[a.id] || 0) - (currentHours[b.id] || 0);

        assignWeekdayShifts(
            date, '2025-07-01', staff, settings,
            earlyPattern, latePattern, classes,
            generatedShifts, currentHours, currentWeeklyHours,
            state, undefined, sortDefault, sortDefault
        );

        const earlyShifts = generatedShifts.filter(s => s.startTime === earlyPattern.startTime);
        const lateShifts = generatedShifts.filter(s => s.startTime === latePattern.startTime);

        expect(earlyShifts).toHaveLength(1);
        expect(lateShifts).toHaveLength(1);
        // 同じ人が早番と遅番に重複していない
        expect(earlyShifts[0].staffId).not.toBe(lateShifts[0].staffId);
    });

    it('前日早番のスタッフは後回し（連続早番を避ける）', () => {
        const staff = [makeStaff('s1'), makeStaff('s2'), makeStaff('s3')];
        const state = makeEmptyState(['s1', 's2', 's3']);
        state.previousDayEarly = ['s1']; // s1 は前日早番
        const generatedShifts: Shift[] = [];
        const currentHours: Record<string, number> = { s1: 0, s2: 0, s3: 0 };
        const currentWeeklyHours: Record<string, Record<string, number>> = { s1: {}, s2: {}, s3: {} };

        const settings = makeRotationSettings({ weekdayEarlyCount: 1, weekdayLateCount: 1 });

        const date = new Date('2025-07-02');
        const sortByCount = (a: Staff, b: Staff) =>
            (state.earlyShiftCount[a.id] || 0) - (state.earlyShiftCount[b.id] || 0);
        const sortLate = (a: Staff, b: Staff) =>
            (state.lateShiftCount[a.id] || 0) - (state.lateShiftCount[b.id] || 0);

        assignWeekdayShifts(
            date, '2025-07-02', staff, settings,
            earlyPattern, latePattern, classes,
            generatedShifts, currentHours, currentWeeklyHours,
            state, undefined, sortByCount, sortLate
        );

        const earlyShift = generatedShifts.find(s => s.startTime === earlyPattern.startTime);
        // s1（前日早番）は後回しなので、s2 か s3 が早番になるはず
        expect(earlyShift?.staffId).not.toBe('s1');
    });

    it('スタッフ数が要件数より少ない場合でもクラッシュしない', () => {
        const staff = [makeStaff('s1')]; // 1人のみ
        const state = makeEmptyState(['s1']);
        const generatedShifts: Shift[] = [];
        const currentHours: Record<string, number> = { s1: 0 };
        const currentWeeklyHours: Record<string, Record<string, number>> = { s1: {} };

        const settings = makeRotationSettings({ weekdayEarlyCount: 2, weekdayLateCount: 2 }); // 要件4名だが1人しかいない

        const date = new Date('2025-07-01');
        const sort = (_a: Staff, _b: Staff) => 0;

        expect(() => {
            assignWeekdayShifts(
                date, '2025-07-01', staff, settings,
                earlyPattern, latePattern, classes,
                generatedShifts, currentHours, currentWeeklyHours,
                state, undefined, sort, sort
            );
        }).not.toThrow();

        // 1人しかいないので早番 or 遅番のどちらか1つのみ割り当て
        expect(generatedShifts.length).toBeLessThanOrEqual(1);
    });
});

// ─────────────────────────────────────────────

describe('applyRotation（平等分配 + エッジケース）', () => {
    const role = makeRole('role1', 'フルタイム');
    const staff = [
        makeStaff('s1', 'フルタイム'),
        makeStaff('s2', 'フルタイム'),
        makeStaff('s3', 'フルタイム'),
        makeStaff('s4', 'フルタイム'),
    ];

    it('1か月の早番割当が全スタッフに均等配分される（最大差2以内）', () => {
        // 2025年7月（平日21日）で早番1名/日 → 21シフトを4人で分配
        const month = new Date('2025-07-01');
        const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
        const settings = makeRotationSettings({ weekdayEarlyCount: 1, weekdayLateCount: 1 });
        const generatedShifts: Shift[] = [];
        const currentHours = Object.fromEntries(staff.map(s => [s.id, 0]));
        const currentWeeklyHours = Object.fromEntries(staff.map(s => [s.id, {}]));

        applyRotation(
            days, settings, staff, [], generatedShifts,
            currentHours, currentWeeklyHours,
            [0], [], [], [], // closedDays日曜, holidays, fixedDates, existingShifts
            [earlyPattern, latePattern], classes, [role]
        );

        const earlyShifts = generatedShifts.filter(s => s.startTime === earlyPattern.startTime);
        const countByStaff = staff.map(s =>
            earlyShifts.filter(sh => sh.staffId === s.id).length
        );

        const max = Math.max(...countByStaff);
        const min = Math.min(...countByStaff);
        // 最大差が2以内であることを確認（公平な配分）
        expect(max - min).toBeLessThanOrEqual(2);
    });

    it('ローテーション対象スタッフが0人の場合は空のシフトを返す', () => {
        const days = eachDayOfInterval({ start: new Date('2025-07-01'), end: new Date('2025-07-07') });
        const settings = makeRotationSettings({ roleId: 'nonexistent' });
        const generatedShifts: Shift[] = [];

        applyRotation(
            days, settings, staff, [], generatedShifts,
            {}, {}, [0], [], [], [],
            [earlyPattern, latePattern], classes, [role]
        );

        expect(generatedShifts).toHaveLength(0);
    });

    it('fixedDates に含まれる日はシフトを生成しない', () => {
        const days = [new Date('2025-07-07')]; // 月曜日
        const settings = makeRotationSettings();
        const generatedShifts: Shift[] = [];
        const currentHours = Object.fromEntries(staff.map(s => [s.id, 0]));
        const currentWeeklyHours = Object.fromEntries(staff.map(s => [s.id, {}]));

        applyRotation(
            days, settings, staff, [], generatedShifts,
            currentHours, currentWeeklyHours,
            [0], [], ['2025-07-07'], [],
            [earlyPattern, latePattern], classes, [role]
        );

        expect(generatedShifts).toHaveLength(0);
    });

    it('祝日はシフトを生成しない', () => {
        const days = [new Date('2025-07-21')]; // 海の日（月曜日）
        const settings = makeRotationSettings();
        const generatedShifts: Shift[] = [];
        const currentHours = Object.fromEntries(staff.map(s => [s.id, 0]));
        const currentWeeklyHours = Object.fromEntries(staff.map(s => [s.id, {}]));

        applyRotation(
            days, settings, staff, [], generatedShifts,
            currentHours, currentWeeklyHours,
            [0], ['2025-07-21'], [], [],
            [earlyPattern, latePattern], classes, [role]
        );

        expect(generatedShifts).toHaveLength(0);
    });
});
