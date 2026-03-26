import { describe, it, expect } from 'vitest';
import { timeToMinutes, calculateDuration, calculateTotalHours, formatHours } from '../timeUtils';

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
                { staffId: 'UNASSIGNED', startTime: '10:00', endTime: '15:00' },
                { staffId: 's2', startTime: '09:00', endTime: '13:00', isError: true }
            ];
            const totals = calculateTotalHours(shifts);
            expect(totals['s1']).toBe(9);
            expect(totals['UNASSIGNED']).toBeUndefined();
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
});
