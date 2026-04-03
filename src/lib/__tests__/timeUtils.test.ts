/**
 * TEST-2: timeUtils.ts のユニットテスト
 *
 * テスト対象:
 * - calculateLegalBreak: 境界値テスト（6h, 6h超, 8h超）
 * - calculateExceptionBreak: 例外休憩の閾値テスト
 * - calculateBreakMinutes: 統合テスト（法定 vs 例外の優先度）
 * - calculateActualWorkingHours: 総合テスト
 * - calculateDuration: 日跨ぎシフトの計算テスト
 */

import { describe, it, expect } from 'vitest';
import {
    calculateLegalBreak,
    calculateExceptionBreak,
    calculateBreakMinutes,
    calculateActualWorkingHours,
    calculateDuration,
    calculateTotalHours,
    formatHours,
} from '../../utils/timeUtils';
import type { BreakSettings } from '../../types';

// ── テスト用ヘルパー ──────────────────────────
const makeBreakSettings = (overrides: Partial<BreakSettings> = {}): BreakSettings => ({
    exceptionEnabled: false,
    exceptionThresholdTime: '12:00',
    exceptionBreakMinutes: 30,
    displayActualHoursInModal: false,
    displayActualHoursInExcel: false,
    ...overrides,
});

// ─────────────────────────────────────────────

describe('calculateDuration', () => {
    it('通常シフトの時間計算（09:00〜18:00 = 9h）', () => {
        expect(calculateDuration('09:00', '18:00')).toBe(9);
    });

    it('日跨ぎシフトの計算（22:00〜02:00 = 4h）', () => {
        expect(calculateDuration('22:00', '02:00')).toBe(4);
    });

    it('深夜跨ぎシフトの計算（23:00〜07:00 = 8h）', () => {
        expect(calculateDuration('23:00', '07:00')).toBe(8);
    });

    it('ぴったり8時間（09:00〜17:00 = 8h）', () => {
        expect(calculateDuration('09:00', '17:00')).toBe(8);
    });

    it('入力が空の場合は 0 を返す', () => {
        expect(calculateDuration('', '18:00')).toBe(0);
        expect(calculateDuration('09:00', '')).toBe(0);
    });

    it('30分シフトの計算（09:00〜09:30 = 0.5h）', () => {
        expect(calculateDuration('09:00', '09:30')).toBe(0.5);
    });
});

// ─────────────────────────────────────────────

describe('calculateLegalBreak（労働基準法34条）', () => {
    it('6時間以下は休憩 0分', () => {
        expect(calculateLegalBreak(6 * 60)).toBe(0);        // ちょうど6h
        expect(calculateLegalBreak(5 * 60 + 59)).toBe(0);   // 5h59m
        expect(calculateLegalBreak(0)).toBe(0);
    });

    it('6時間超 〜 8時間以下は休憩 45分', () => {
        expect(calculateLegalBreak(6 * 60 + 1)).toBe(45);   // 6h1m
        expect(calculateLegalBreak(7 * 60)).toBe(45);        // 7h
        expect(calculateLegalBreak(8 * 60)).toBe(45);        // ちょうど8h
    });

    it('8時間超は休憩 60分', () => {
        expect(calculateLegalBreak(8 * 60 + 1)).toBe(60);   // 8h1m
        expect(calculateLegalBreak(9 * 60)).toBe(60);        // 9h
        expect(calculateLegalBreak(12 * 60)).toBe(60);       // 12h
    });
});

// ─────────────────────────────────────────────

describe('calculateExceptionBreak', () => {
    const settings = makeBreakSettings({
        exceptionEnabled: true,
        exceptionThresholdTime: '12:00',
        exceptionBreakMinutes: 30,
    });

    it('exceptionEnabled が false のときは 0 を返す', () => {
        const disabled = makeBreakSettings({ exceptionEnabled: false });
        expect(calculateExceptionBreak('09:00', disabled)).toBe(0);
        expect(calculateExceptionBreak('11:00', disabled)).toBe(0);
    });

    it('開始時刻が閾値以前（<= 12:00）は例外休憩を返す', () => {
        expect(calculateExceptionBreak('09:00', settings)).toBe(30); // 9時開始
        expect(calculateExceptionBreak('12:00', settings)).toBe(30); // ちょうど12時開始
    });

    it('開始時刻が閾値より後（> 12:00）は 0 を返す', () => {
        expect(calculateExceptionBreak('12:01', settings)).toBe(0);
        expect(calculateExceptionBreak('14:00', settings)).toBe(0);
    });

    it('閾値時刻が異なる場合のテスト', () => {
        const s = makeBreakSettings({
            exceptionEnabled: true,
            exceptionThresholdTime: '10:00',
            exceptionBreakMinutes: 60,
        });
        expect(calculateExceptionBreak('09:00', s)).toBe(60);  // 閾値以前
        expect(calculateExceptionBreak('10:00', s)).toBe(60);  // ちょうど閾値
        expect(calculateExceptionBreak('10:01', s)).toBe(0);   // 閾値超
    });
});

// ─────────────────────────────────────────────

describe('calculateBreakMinutes（法定 vs 例外の優先度）', () => {
    it('settingsなし: 法定休憩のみ適用', () => {
        expect(calculateBreakMinutes('09:00', '18:00')).toBe(60); // 9h → 60分
        expect(calculateBreakMinutes('09:00', '16:00')).toBe(45); // 7h → 45分
        expect(calculateBreakMinutes('09:00', '14:00')).toBe(0);  // 5h → 0分
    });

    it('法定休憩が 0 の場合は例外休憩を適用', () => {
        const s = makeBreakSettings({
            exceptionEnabled: true,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 30,
        });
        // 5h勤務（法定0）、かつ開始09:00（閾値以内） → 例外30分
        expect(calculateBreakMinutes('09:00', '14:00', s)).toBe(30);
    });

    it('法定休憩が適用される場合は、法定が優先（例外は無視）', () => {
        const s = makeBreakSettings({
            exceptionEnabled: true,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 30,
        });
        // 7h勤務（法定45分）、かつ開始09:00（例外30分） → max(45, 30) = 45
        expect(calculateBreakMinutes('09:00', '16:00', s)).toBe(45);
    });

    it('例外が法定より大きい場合は例外を適用', () => {
        const s = makeBreakSettings({
            exceptionEnabled: true,
            exceptionThresholdTime: '12:00',
            exceptionBreakMinutes: 90, // 例外90分
        });
        // 9h勤務（法定60分）、かつ開始09:00（例外90分） → max(60, 90) = 90
        expect(calculateBreakMinutes('09:00', '18:00', s)).toBe(90);
    });
});

// ─────────────────────────────────────────────

describe('calculateActualWorkingHours', () => {
    it('settingsなし: 法定休憩のみ差引', () => {
        // 9h - 1h(法定) = 8h
        expect(calculateActualWorkingHours('09:00', '18:00')).toBe(8);
        // 7h - 45min(法定) = 6.25h
        expect(calculateActualWorkingHours('09:00', '16:00')).toBeCloseTo(6.25);
        // 5h - 0(法定なし) = 5h
        expect(calculateActualWorkingHours('09:00', '14:00')).toBe(5);
    });

    it('日跨ぎシフト（22:00〜07:00 = 9h → 法定60分 → 8h実働）', () => {
        expect(calculateActualWorkingHours('22:00', '07:00')).toBe(8);
    });

    it('入力が空の場合は 0 を返す', () => {
        expect(calculateActualWorkingHours('', '18:00')).toBe(0);
        expect(calculateActualWorkingHours('09:00', '')).toBe(0);
    });
});

// ─────────────────────────────────────────────

describe('calculateTotalHours', () => {
    it('複数スタッフのシフト合計を正確に計算', () => {
        const shifts = [
            { staffId: 's1', startTime: '09:00', endTime: '18:00' }, // 9h
            { staffId: 's1', startTime: '09:00', endTime: '14:00' }, // 5h
            { staffId: 's2', startTime: '13:00', endTime: '18:00' }, // 5h
        ];
        const result = calculateTotalHours(shifts);
        expect(result['s1']).toBe(14);
        expect(result['s2']).toBe(5);
    });

    it('isError=true のシフトは除外', () => {
        const shifts = [
            { staffId: 's1', startTime: '09:00', endTime: '18:00' },
            { staffId: 's1', startTime: '09:00', endTime: '14:00', isError: true },
        ];
        const result = calculateTotalHours(shifts);
        expect(result['s1']).toBe(9);
    });

    it('UNASSIGNED スタッフは除外', () => {
        const shifts = [
            { staffId: 'UNASSIGNED', startTime: '09:00', endTime: '18:00' },
            { staffId: 's1', startTime: '09:00', endTime: '14:00' },
        ];
        const result = calculateTotalHours(shifts);
        expect(result['UNASSIGNED']).toBeUndefined();
        expect(result['s1']).toBe(5);
    });
});

// ─────────────────────────────────────────────

describe('formatHours', () => {
    it('整数時間は .0 形式', () => {
        expect(formatHours(8)).toBe('8.0');
        expect(formatHours(20)).toBe('20.0');
    });

    it('0.5刻みは 1桁小数', () => {
        expect(formatHours(8.5)).toBe('8.5');
        expect(formatHours(20.5)).toBe('20.5');
    });

    it('0.25/0.75は 2桁小数', () => {
        expect(formatHours(8.25)).toBe('8.25');
        expect(formatHours(8.75)).toBe('8.75');
    });
});
