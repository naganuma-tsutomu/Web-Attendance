import { describe, it, expect } from 'vitest';
import { generateShiftsForMonth } from '../algorithm';
import type { Staff, ShiftPreference, DynamicRole } from '../../types';

// テスト用のスタッフデータ
const makeStaff = (overrides: Partial<Staff> & { id: string; name: string; role: string }): Staff => ({
    hoursTarget: 160,
    ...overrides,
});

const emptyPrefs: ShiftPreference[] = [];
const emptyRoles: DynamicRole[] = [];

describe('generateShiftsForMonth', () => {
    it('日曜日のシフトは生成されない', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);

        // 2025-06 の日曜日（1, 8, 15, 22, 29 日）にシフトが存在しないことを確認
        const sundays = ['2025-06-01', '2025-06-08', '2025-06-15', '2025-06-22', '2025-06-29'];
        sundays.forEach(dateStr => {
            const sundayShifts = shifts.filter(s => s.date === dateStr);
            expect(sundayShifts).toHaveLength(0);
        });
    });

    it('スタッフが1人の場合は不足分にエラーシフトが生成される', () => {
        const staff = [makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' })];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);

        const errorShifts = shifts.filter(s => s.isError === true);
        expect(errorShifts.length).toBeGreaterThan(0);
        errorShifts.forEach(s => {
            expect(s.staffId).toBe('UNASSIGNED');
        });
    });

    it('指定した休日の日はそのスタッフのシフトが生成されない', () => {
        const staff = [
            makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' }),
            makeStaff({ id: 's2', name: 'スタッフB', role: '正社員' }),
        ];
        const prefs: ShiftPreference[] = [{
            id: 'p1',
            staffId: 's1',
            yearMonth: '2025-06',
            unavailableDates: ['2025-06-02'], // 月曜
        }];

        const shifts = generateShiftsForMonth('2025-06', staff, prefs, emptyRoles);
        const targetDayShifts = shifts.filter(s => s.date === '2025-06-02' && s.staffId === 's1');
        expect(targetDayShifts).toHaveLength(0);
    });

    it('土曜日のシフトが生成される', () => {
        const staff = [
            makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' }),
            makeStaff({ id: 's2', name: 'スタッフB', role: '正社員' }),
        ];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);

        // 2025-06-07 は土曜日
        const saturdayShifts = shifts.filter(s => s.date === '2025-06-07');
        expect(saturdayShifts.length).toBeGreaterThan(0);
    });


    it('生成されたシフトIDに重複がない', () => {
        const staff = [
            makeStaff({ id: 's1', name: 'スタッフA', role: '正社員' }),
            makeStaff({ id: 's2', name: 'スタッフB', role: '正社員' }),
        ];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);
        const ids = shifts.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('第n週の固定休日が正しく反映される', () => {
        const staff = [
            makeStaff({
                id: 's1',
                name: 'スタッフA',
                role: '正社員',
                availableDays: [{ day: 1, weeks: [1, 3, 5] }] // 第1, 3, 5月曜のみ出勤 (第2, 4月曜は休み)
            }),
            makeStaff({ id: 's2', name: 'スタッフB', role: '正社員' }),
            makeStaff({ id: 's3', name: 'スタッフC', role: '正社員' }),
            makeStaff({ id: 's4', name: 'スタッフD', role: '正社員' }),
            makeStaff({ id: 's5', name: 'スタッフE', role: '正社員' }),
            makeStaff({ id: 's6', name: 'スタッフF', role: '正社員' }),
        ];
        // 2025年6月の月曜日: 02(第1), 09(第2), 16(第3), 23(第4), 30(第5)
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);

        // 第1月曜 (02日) -> 出勤
        expect(shifts.filter(s => s.date === '2025-06-02' && s.staffId === 's1')).toHaveLength(1);
        // 第2月曜 (09日) -> 休み
        expect(shifts.filter(s => s.date === '2025-06-09' && s.staffId === 's1')).toHaveLength(0);
        // 第3月曜 (16日) -> 出勤
        expect(shifts.filter(s => s.date === '2025-06-16' && s.staffId === 's1')).toHaveLength(1);
        // 第4月曜 (23日) -> 休み
        expect(shifts.filter(s => s.date === '2025-06-23' && s.staffId === 's1')).toHaveLength(0);
        // 第5月曜 (30日) -> 出勤
        expect(shifts.filter(s => s.date === '2025-06-30' && s.staffId === 's1')).toHaveLength(1);
    });

    it('hoursTarget が null の場合は労働時間制限なく割り当てられる', () => {
        const staff = [
            makeStaff({ id: 's1', name: 'スタッフA', role: '準社員', hoursTarget: null })
        ];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);

        // 2025年6月の月〜金は21日間、土曜日は4日間、計25日間
        // 準社員は平日の上限6人枠と土曜日の1人枠に入る（他にスタッフがいないため）
        const staffAShifts = shifts.filter(s => s.staffId === 's1');
        expect(staffAShifts.length).toBe(25);
    });

    it('正社員がいる場合、準社員は土曜日に割り当てられない', () => {
        const staff = [
            makeStaff({ id: 'ft1', name: '正社員A', role: '正社員' }),
            makeStaff({ id: 'ft2', name: '正社員B', role: '正社員' }),
            makeStaff({ id: 's1', name: '準社員A', role: '準社員' })
        ];
        const shifts = generateShiftsForMonth('2025-06', staff, emptyPrefs, emptyRoles);

        // 土曜日のシフトを取得
        const saturdayShifts = shifts.filter(s => {
            const date = new Date(s.date);
            return date.getDay() === 6;
        });

        // 準社員Aが土曜日にいないことを確認
        const s1SatShifts = saturdayShifts.filter(s => s.staffId === 's1');
        expect(s1SatShifts.length).toBe(0);
    });
});
