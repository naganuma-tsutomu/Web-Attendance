import { describe, it, expect } from 'vitest';
import { applyLeaderRebalance } from '../leaderRebalance';
import type { Shift, Staff, DynamicRole, ShiftClass } from '../../types';

const makeStaff = (overrides: Partial<Staff> & { id: string; name: string; role: string }): Staff => ({
    hoursTarget: 160,
    weeklyHoursTarget: null,
    ...overrides,
});

const makeShift = (overrides: Partial<Shift> & { id: string; date: string; staffId: string; classType: string }): Shift => ({
    startTime: '09:00',
    endTime: '18:00',
    ...overrides,
});

const roles: DynamicRole[] = [
    { id: 'role_full', name: '正社員', targetHours: null, display_order: 1, patterns: [] },
    { id: 'role_part', name: 'パート', targetHours: null, display_order: 2, patterns: [] },
];

const classes: ShiftClass[] = [
    { id: 'class_a', name: 'クラスA', display_order: 0, auto_allocate: 1 },
    { id: 'class_b', name: 'クラスB', display_order: 1, auto_allocate: 1 },
];

describe('applyLeaderRebalance', () => {
    it('leaderRoleId が null のとき何も変更しない', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f1', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'パート' }),
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: null });
        expect(result.shifts).toEqual(shifts);
        expect(result.swaps).toHaveLength(0);
    });

    it('クラスA に leader 0、クラスB に leader 2、時間一致 → スワップ発生', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f1', classType: 'class_b' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'f2', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'パート' }),
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員' }),
            makeStaff({ id: 'f2', name: '正社員2', role: '正社員' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        expect(result.swaps).toHaveLength(1);
        // p1 が classB に、正社員のいずれかが classA に移っている
        const a = result.shifts.find(s => s.id === 's1')!;
        expect(a.classType).toBe('class_b');
        const movedToA = result.shifts.filter(s => s.classType === 'class_a' && s.date === '2026-01-01');
        expect(movedToA).toHaveLength(1);
        expect(['f1', 'f2']).toContain(movedToA[0].staffId);
    });

    it('時間不一致 → スワップなし', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a', startTime: '09:00', endTime: '18:00' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f1', classType: 'class_b', startTime: '10:00', endTime: '19:00' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'f2', classType: 'class_b', startTime: '10:00', endTime: '19:00' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'パート' }),
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員' }),
            makeStaff({ id: 'f2', name: '正社員2', role: '正社員' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        expect(result.swaps).toHaveLength(0);
        expect(result.shifts).toEqual(shifts);
    });

    it('クラスB に leader が1人だけ → 反転防止でスワップなし', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f1', classType: 'class_b' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'p2', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'パート' }),
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員' }),
            makeStaff({ id: 'p2', name: 'パート2', role: 'パート' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        expect(result.swaps).toHaveLength(0);
    });

    it('classIds 制約で対象スタッフが移動不可 → スワップなし', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f1', classType: 'class_b' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'f2', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'パート' }),
            // f1 と f2 の両方とも classA に所属できない
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員', classIds: ['class_b'] }),
            makeStaff({ id: 'f2', name: '正社員2', role: '正社員', classIds: ['class_b'] }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        expect(result.swaps).toHaveLength(0);
    });

    it('staff.role が ID（"role_full"）でもマッチする', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f1', classType: 'class_b' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'f2', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'role_part' }),
            makeStaff({ id: 'f1', name: '正社員1', role: 'role_full' }),
            makeStaff({ id: 'f2', name: '正社員2', role: 'role_full' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        expect(result.swaps).toHaveLength(1);
    });

    it('クラスA に既に leader がいる → スワップなし', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'f1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'f2', classType: 'class_b' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'f3', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員' }),
            makeStaff({ id: 'f2', name: '正社員2', role: '正社員' }),
            makeStaff({ id: 'f3', name: '正社員3', role: '正社員' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        expect(result.swaps).toHaveLength(0);
    });

    it('isError や UNASSIGNED は対象外', () => {
        const shifts: Shift[] = [
            makeShift({ id: 's1', date: '2026-01-01', staffId: 'p1', classType: 'class_a' }),
            makeShift({ id: 's2', date: '2026-01-01', staffId: 'UNASSIGNED', classType: 'class_b' }),
            makeShift({ id: 's3', date: '2026-01-01', staffId: 'f1', classType: 'class_b', isError: true }),
            makeShift({ id: 's4', date: '2026-01-01', staffId: 'f2', classType: 'class_b' }),
        ];
        const staffList: Staff[] = [
            makeStaff({ id: 'p1', name: 'パート1', role: 'パート' }),
            makeStaff({ id: 'f1', name: '正社員1', role: '正社員' }),
            makeStaff({ id: 'f2', name: '正社員2', role: '正社員' }),
        ];
        const result = applyLeaderRebalance({ shifts, staffList, roles, classes, leaderRoleId: 'role_full' });
        // f1 はエラー、f2 が唯一の有効 leader → leadersInB.length = 1 で反転防止が働きスワップなし
        expect(result.swaps).toHaveLength(0);
    });
});
