import { describe, expect, it } from 'vitest';
import { findShiftConflict, timeRangesOverlap } from '../../../shared/shiftIntegrity';

describe('shiftIntegrity', () => {
    it('部分的に重なる時間帯を検出する', () => {
        expect(timeRangesOverlap('09:00', '12:00', '11:00', '15:00')).toBe(true);
    });

    it('境界が接するだけの時間帯は重複としない', () => {
        expect(timeRangesOverlap('09:00', '12:00', '12:00', '15:00')).toBe(false);
    });

    it('日跨ぎ時間帯と翌日側の時間帯の重複を検出する', () => {
        expect(timeRangesOverlap('22:00', '02:00', '01:00', '03:00')).toBe(true);
        expect(timeRangesOverlap('22:00', '02:00', '03:00', '04:00')).toBe(false);
    });

    it('同じスタッフ・日付の別クラス重複を検出する', () => {
        const conflict = findShiftConflict([
            { date: '2026-08-03', staffId: 's1', startTime: '09:00', endTime: '18:00', classType: 'a' },
            { date: '2026-08-03', staffId: 's1', startTime: '10:00', endTime: '12:00', classType: 'b' },
        ]);

        expect(conflict?.first.classType).toBe('a');
        expect(conflict?.second.classType).toBe('b');
    });

    it('別スタッフ、未割り当て、エラーシフトは競合対象にしない', () => {
        expect(findShiftConflict([
            { date: '2026-08-03', staffId: 's1', startTime: '09:00', endTime: '18:00' },
            { date: '2026-08-03', staffId: 's2', startTime: '09:00', endTime: '18:00' },
            { date: '2026-08-03', staffId: 'UNASSIGNED', startTime: '09:00', endTime: '18:00' },
            { date: '2026-08-03', staffId: 's1', startTime: '09:00', endTime: '18:00', isError: true },
        ])).toBeNull();
    });
});
