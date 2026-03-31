import { describe, it, expect } from 'vitest';
import { timeToMinutes, calculateDuration, calculateTotalHours, formatHours, calculateBreakMinutes, calculateActualWorkingHours } from '../timeUtils';
import { UNASSIGNED_STAFF_ID } from '../../constants';
import type { BreakSettings } from '../../types';

describe('timeUtils', () => {
    describe('timeToMinutes', () => {
        it('HH:MMを分数に変換する', () => {
            expect(timeToMinutes('09:00')).toBe(540);
            expect(timeToMinutes('18:30')).toBe(1110);
            expect(timeToMinutes('00:00')).toBe(0);
        });
    });

    describe('calculateDuration', () => {
        it('開始時間と終了時間から労働時間を計算する', () => {
            expect(calculateDuration('09:00', '18:00')).toBe(9);
            expect(calculateDuration('09:30', '18:00')).toBe(8.5);
        });

        it('日またぎのシフトでも正しく計算できる', () => {
            expect(calculateDuration('22:00', '02:00')).toBe(4);
            expect(calculateDuration('23:30', '06:00')).toBe(6.5);
        });
        
        it('空の文字列が渡された場合は0を返す', () => {
            expect(calculateDuration('', '18:00')).toBe(0);
            expect(calculateDuration('09:00', '')).toBe(0);
        });
    });

    describe('calculateTotalHours', () => {
        it('各スタッフの合計労働時間を計算する', () => {
            const shifts = [
                { staffId: 's1', startTime: '09:00', endTime: '18:00' },
                { staffId: 's2', startTime: '10:00', endTime: '15:00' },
                { staffId: 's1', startTime: '09:00', endTime: '13:00' }
            ];
            const totals = calculateTotalHours(shifts);
            expect(totals['s1']).toBe(13); // 9 + 4
            expect(totals['s2']).toBe(5);
        });

        it('未割り当て(UNASSIGNED)やエラーシフトは除外される', () => {
            const shifts = [
                { staffId: 's1', startTime: '09:00', endTime: '18:00' },
                { staffId: UNASSIGNED_STAFF_ID, startTime: '10:00', endTime: '15:00' },
                { staffId: 's2', startTime: '09:00', endTime: '13:00', isError: true }
            ];
            const totals = calculateTotalHours(shifts);
            expect(totals['s1']).toBe(9);
            expect(totals[UNASSIGNED_STAFF_ID]).toBeUndefined();
            expect(totals['s2']).toBeUndefined();
        });
    });

    describe('formatHours', () => {
        it('時間を0.25単位の文字列にフォーマットする', () => {
            expect(formatHours(20)).toBe('20.0');
            expect(formatHours(20.25)).toBe('20.25');
            expect(formatHours(20.5)).toBe('20.5');
            expect(formatHours(20.75)).toBe('20.75');
            expect(formatHours(20.1)).toBe('20.0'); // 4で割った最近似値に丸まる
            expect(formatHours(20.8)).toBe('20.75');
        });
    });

    describe('calculateBreakMinutes', () => {
        const breakSettings: BreakSettings = {
            exceptionEnabled: true,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 30,
            displayActualHoursInModal: false,
            displayActualHoursInExcel: false
        };

        it('6時間以下の場合は休憩0分', () => {
            expect(calculateBreakMinutes('13:00', '18:00', breakSettings)).toBe(0); // 5h
            expect(calculateBreakMinutes('13:00', '19:00', breakSettings)).toBe(0); // 6h
        });

        it('6時間超〜8時間以下の場合は休憩45分', () => {
            expect(calculateBreakMinutes('13:00', '20:00', breakSettings)).toBe(45); // 7h
            expect(calculateBreakMinutes('13:00', '21:00', breakSettings)).toBe(45); // 8h
        });

        it('8時間超の場合は休憩60分', () => {
            expect(calculateBreakMinutes('13:00', '22:00', breakSettings)).toBe(60); // 9h
        });

        it('例外出勤時間（12:00以前）で労働時間が短い場合でも30分休憩（設定時）', () => {
            // 11:00〜16:00 (5h) 法定0 < 例外30
            expect(calculateBreakMinutes('11:00', '16:00', breakSettings)).toBe(30); 
            // 12:00〜16:00 (4h) 法定0 < 例外30
            expect(calculateBreakMinutes('12:00', '16:00', breakSettings)).toBe(30);
        });

        it('法定休憩時間が例外休憩時間を上回る場合は法定休憩を優先', () => {
            // 11:00〜18:00 (7h) 法定45 > 例外30
            expect(calculateBreakMinutes('11:00', '18:00', breakSettings)).toBe(45);
            // 11:00〜20:00 (9h) 法定60 > 例外30
            expect(calculateBreakMinutes('11:00', '20:00', breakSettings)).toBe(60);
        });

        it('例外設定がOFFの場合は法定休憩のみ', () => {
            const offSettings = { ...breakSettings, exceptionEnabled: false };
            expect(calculateBreakMinutes('11:00', '16:00', offSettings)).toBe(0); // 5h -> 0
        });
    });

    describe('calculateActualWorkingHours', () => {
        const breakSettings: BreakSettings = {
            exceptionEnabled: true,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 30,
            displayActualHoursInModal: false,
            displayActualHoursInExcel: false
        };

        it('休憩無し', () => {
            expect(calculateActualWorkingHours('13:00', '18:00', breakSettings)).toBe(5); // 5h - 0 = 5h
        });

        it('45分休憩', () => {
            expect(calculateActualWorkingHours('13:00', '20:00', breakSettings)).toBe(6.25); // 7h - 45m = 6h15m (6.25)
        });

        it('60分休憩', () => {
            expect(calculateActualWorkingHours('13:00', '22:00', breakSettings)).toBe(8); // 9h - 60m = 8h
        });

        it('例外30分休憩', () => {
            expect(calculateActualWorkingHours('11:00', '16:00', breakSettings)).toBe(4.5); // 5h - 30m = 4h30m (4.5)
        });
    });
});
