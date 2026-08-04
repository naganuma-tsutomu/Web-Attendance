import { describe, expect, it } from 'vitest';
import { getHolidayDisplay } from '../staffDisplayUtils';

describe('getHolidayDisplay', () => {
    it('未設定の場合は設定なしを返す', () => {
        expect(getHolidayDisplay()).toBe('設定なし');
        expect(getHolidayDisplay([])).toBe('設定なし');
    });

    it('勤務しない曜日を固定休日として表示する', () => {
        expect(getHolidayDisplay([1, 2, 3, 4, 5])).toBe('土');
    });

    it('週指定がある曜日は勤務しない週を表示する', () => {
        expect(getHolidayDisplay([1, 2, 3, 4, 5, { day: 6, weeks: [1, 3, 5] }]))
            .toBe('土 (第2,4)');
    });

    it('全曜日・全週が勤務可能なら設定なしを返す', () => {
        expect(getHolidayDisplay([1, 2, 3, 4, 5, { day: 6, weeks: [1, 2, 3, 4, 5] }]))
            .toBe('設定なし');
    });
});
