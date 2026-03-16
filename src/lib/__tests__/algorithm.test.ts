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
                    { id: 'p1', name: '早番', startTime: '09:00', endTime: '17:00', sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, holiday: 1 }
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
                    { id: 'p1', name: 'フルタイム', startTime: '09:00', endTime: '18:00', sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1, holiday: 1 }
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

    it('スタッフのavailableDaysの特定の週(nthWeek)指定が正しく機能する', () => {
        const staff = [makeStaff({ 
            id: 's1', 
            name: 'スタッフA', 
            role: 'パート',
            // 毎週月曜日（day: 1）だが、第1週と第3週のみ出勤可能
            availableDays: [0, { day: 1, weeks: [1, 3] }, 2, 3, 4, 5, 6] 
        })];
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji' })]; // 毎日必要

        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);
        const myShifts = shifts.filter(s => s.staffId === 's1');

        // 2025-06 の月曜日は 2, 9, 16, 23, 30 日
        // 2日(第1週)、16日(第3週) にだけシフトが入るはず
        const monDates = ['2025-06-02', '2025-06-16'];
        
        // 9日(第2週)、23日(第4週)、30日(第5週)にはシフトがないはず
        const nonWorkingMonDates = ['2025-06-09', '2025-06-23', '2025-06-30'];

        myShifts.forEach(shift => {
            expect(nonWorkingMonDates.includes(shift.date)).toBe(false);
        });

        const assignedDates = myShifts.map(s => s.date);
        monDates.forEach(date => {
            expect(assignedDates.includes(date)).toBe(true);
        });
    });

    it('ShiftPreference (希望休) で指定された日付には割り当てられない', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const prefs: ShiftPreference[] = [
            { id: 'p1', staffId: 's1', yearMonth: '2025-06', unavailableDates: ['2025-06-05', '2025-06-06'] }
        ];
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji' })];

        const shifts = generateShiftsForMonth('2025-06', staff, prefs, emptyRoles, dummyClasses, [], reqs);
        const myShifts = shifts.filter(s => s.staffId === 's1');

        // 希望休の日に割り当てがされていないことを確認
        expect(myShifts.find(s => s.date === '2025-06-05')).toBeUndefined();
        expect(myShifts.find(s => s.date === '2025-06-06')).toBeUndefined();
    });

    it('ShiftRequirementのdayOfWeek=7（平日のみ）が正しく機能する', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        // 平日のみ (dayOfWeek: 7)
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji', dayOfWeek: 7 })];

        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);
        
        // 2025-06-07 は土曜なので、シフトが生成されないはず
        const satShifts = shifts.filter(s => s.date === '2025-06-07');
        expect(satShifts).toHaveLength(0);

        // 2025-06-02 は月曜なので、生成されるはず
        const monShifts = shifts.filter(s => s.date === '2025-06-02');
        expect(monShifts.length).toBeGreaterThan(0);
    });

    it('weeklyHoursTargetを尊重して週間の割り当てが抑制される', () => {
        const staff = [
            makeStaff({ id: 'sw1', name: 'スタッフW', role: 'パート', weeklyHoursTarget: 20 }) // 週20時間まで
        ];
        // 毎日9時間（9-18）の要件
        const reqs = [makeReq({ id: 'r1', classId: 'class_niji' })];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles, dummyClasses, [], reqs);

        const assignedShifts = shifts.filter(s => s.staffId === 'sw1' && !s.isError);
        
        // 第1週 (6/2 - 6/8) のシフトを集計
        const week1Shifts = assignedShifts.filter(s => s.date >= '2025-06-02' && s.date <= '2025-06-08');
        // 9時間/日 x 2日 = 18時間。3日目は27時間になりNG。なので週に最大2日まで。
        expect(week1Shifts.length).toBeLessThanOrEqual(2);
    });
});
