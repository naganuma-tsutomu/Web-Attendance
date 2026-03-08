import { describe, it, expect } from 'vitest';
import { generateShiftsForMonth } from '../algorithm';
import type { Staff, ShiftPreference, DynamicRole, ShiftRequirement } from '../../types';

// テスト用のスタッフデータ
const makeStaff = (overrides: Partial<Staff> & { id: string; name: string; role: string }): Staff => ({
    hoursTarget: 160,
    ...overrides,
});

// テスト用の必要人数データ
const makeReq = (overrides: Partial<ShiftRequirement> & { id: string; classId: string }): ShiftRequirement => ({
    dayOfWeek: 8, // Everyday
    startTime: '09:00',
    endTime: '18:00',
    minStaffCount: 1,
    priority: 0,
    ...overrides,
});

const emptyPrefs: ShiftPreference[] = [];
const emptyRoles: DynamicRole[] = [];
const dummyClasses = [
    { id: 'class_niji', name: '虹組', display_order: 0, auto_allocate: 1 },
    { id: 'class_smile', name: 'スマイル組', display_order: 1, auto_allocate: 1 },
];

describe('generateShiftsForMonth', () => {
    it('日曜日のシフトは生成されない', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji' })];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);

        // 2025-06 の日曜日（1, 8, 15, 22, 29 日）にシフトが存在しないことを確認
        const sundays = ['2025-06-01', '2025-06-08', '2025-06-15', '2025-06-22', '2025-06-29'];
        sundays.forEach(dateStr => {
            const sundayShifts = shifts.filter(s => s.date === dateStr);
            expect(sundayShifts).toHaveLength(0);
        });
    });

    it('必要人数設定に基づいてシフトが生成される', () => {
        const staff = [
            makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' }),
            makeStaff({ id: 's2', name: 'スタッフB', role: '正社員' }),
        ];
        const reqs = [
            makeReq({ id: 'r1', classId: 'class_niji', minStaffCount: 2 })
        ];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);

        const weekdayShifts = shifts.filter(s => s.date === '2025-06-02'); // 月曜
        expect(weekdayShifts).toHaveLength(2);
        expect(weekdayShifts.every(s => s.classType === 'class_niji')).toBe(true);
    });

    it('スタッフが足りない場合は不足分にエラーシフトが生成される', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji', minStaffCount: 2 })];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);

        const errorShifts = shifts.filter(s => s.isError === true && s.date === '2025-06-02');
        expect(errorShifts).toHaveLength(1);
        expect(errorShifts[0].staffId).toBe('UNASSIGNED');
    });

    it('同一スタッフが重複して割り当てられない', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const reqs = [
            makeReq({ id: 'r1', classId: 'class_niji', startTime: '09:00', endTime: '12:00' }),
            makeReq({ id: 'r2', classId: 'class_smile', startTime: '10:00', endTime: '13:00' }), // 重複する時間帯
        ];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);

        const staffAShifts = shifts.filter(s => s.staffId === 's1' && s.date === '2025-06-02');
        // スタッフAはどちらか一方（優先度の高い方など）にしか割り当てられないはず
        expect(staffAShifts.length).toBeLessThanOrEqual(1);

        // もう一方はエラー（UNASSIGNED）になるはず
        const errorShifts = shifts.filter(s => s.isError && s.date === '2025-06-02');
        expect(errorShifts.length).toBe(1);
    });

    it('hourTargetを尊重して割り当てが抑制される', () => {
        const staff = [
            makeStaff({ id: 's1', name: 'スタッフA', role: 'パート', hoursTarget: 20 }) // 超短時間
        ];
        // 毎日9時間（9-18）の要件
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji' })];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);

        const staffAShifts = shifts.filter(s => s.staffId === 's1');
        // 9時間 * 3日 = 27時間 > 20時間 なので、3日目あたりで割り当てられなくなるはず
        expect(staffAShifts.length).toBeLessThan(5);
    });

    it('祝日にはシフトが生成されない', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji' })];
        const holidays = ['2025-06-02']; // 月曜を祝日に設定
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, holidays, reqs);

        const targetDayShifts = shifts.filter(s => s.date === '2025-06-02');
        expect(targetDayShifts).toHaveLength(0);
    });

    it('登録されたパターンに合致しない時間は割り当てられない', () => {
        const roles: DynamicRole[] = [
            {
                id: 'role1',
                name: '正社員',
                targetHours: 160,
                display_order: 1,
                patterns: [
                    { id: 'p1', name: '早番', startTime: '09:00', endTime: '17:00' }
                ]
            }
        ];
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];

        // 要件が 09:00-18:00 (パターンの 09:00-17:00 と一致しない)
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji', startTime: '09:00', endTime: '18:00' })];

        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, roles, dummyClasses, [], reqs);
        const assigned = shifts.filter(s => s.staffId === 's1');

        // 一致しないので割り当てられないはず
        expect(assigned).toHaveLength(0);
        expect(shifts.find(s => s.isError)).toBeDefined();
    });

    it('役職の優先順位（display_order）に従って割り当てられる', () => {
        const roles: DynamicRole[] = [
            { id: 'r_high', name: '優先高', targetHours: 160, display_order: 1, patterns: [] },
            { id: 'r_low', name: '優先低', targetHours: 160, display_order: 10, patterns: [] }
        ];
        const staff = [
            makeStaff({ id: 's_low', name: '後回し', role: '優先低' }),
            makeStaff({ id: 's_high', name: '優先', role: '優先高' })
        ];
        const reqs = [makeReq({ id: 'req1', classId: 'class_niji', minStaffCount: 1 })];

        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, roles, dummyClasses, [], reqs);

        // 最初の日のシフトを確認
        const firstDayShift = shifts.find(s => s.date === '2025-06-02' && !s.isError);
        expect(firstDayShift?.staffId).toBe('s_high'); // 優先度の高いスタッフが選ばれる
    });

    it('要求時間をカバーするパターンがある場合、そのパターンの時間で割り当てられる', () => {
        const roles: DynamicRole[] = [
            {
                id: 'role1',
                name: '正社員',
                targetHours: 160,
                display_order: 1,
                patterns: [
                    { id: 'p1', name: 'フルタイム', startTime: '09:00', endTime: '18:00' }
                ]
            }
        ];
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];

        // 要件は 11:00-12:00
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji', startTime: '11:00', endTime: '12:00' })];

        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, roles, dummyClasses, [], reqs);
        const assigned = shifts.find(s => s.staffId === 's1');

        // 割り当てに成功し、時間はパターンの 09:00-18:00 になっているはず
        expect(assigned).toBeDefined();
        expect(assigned?.startTime).toBe('09:00');
        expect(assigned?.endTime).toBe('18:00');
    });
});
