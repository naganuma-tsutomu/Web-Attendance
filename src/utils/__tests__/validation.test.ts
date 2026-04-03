import { describe, it, expect } from 'vitest';
import {
    validateName,
    validateTimeFormat,
    validateTimeRange,
    validateTargetHours,
    validateWeeklyHoursTarget,
    validateRole,
    validateYearMonth,
    validateDate,
    validateDayOfWeek,
    validateMinStaffCount,
    validateMaxStaffCount,
    safeJsonParse,
} from '../../../functions/utils/validation';

describe('validation - validateName', () => {
    it('正常な名前は null を返す', () => {
        expect(validateName('田中太郎')).toBeNull();
    });

    it('空文字はエラーを返す', () => {
        expect(validateName('')).toContain('入力してください');
    });

    it('空白のみはエラーを返す', () => {
        expect(validateName('   ')).toContain('入力してください');
    });

    it('最大文字数を超えるとエラー', () => {
        const longName = 'あ'.repeat(51);
        expect(validateName(longName)).toContain('50文字以内');
    });

    it('カスタム最大長を指定できる', () => {
        const name = 'あいうえおかきくけこ'; // 9文字
        expect(validateName(name, '名前', 5)).toContain('5文字以内');
        expect(validateName(name, '名前', 10)).toBeNull();
    });
});

describe('validation - validateTimeFormat', () => {
    it('正常な時間は null を返す', () => {
        expect(validateTimeFormat('09:00', '開始時間')).toBeNull();
        expect(validateTimeFormat('23:59', '終了時間')).toBeNull();
        expect(validateTimeFormat('0:00', '開始時間')).toBeNull();
    });

    it('不正な形式はエラーを返す', () => {
        expect(validateTimeFormat('25:00', '時間')).not.toBeNull();
        expect(validateTimeFormat('12:60', '時間')).not.toBeNull();
        expect(validateTimeFormat('abc', '時間')).not.toBeNull();
        expect(validateTimeFormat('', '時間')).not.toBeNull();
    });
});

describe('validation - validateTimeRange', () => {
    it('開始 < 終了は null を返す', () => {
        expect(validateTimeRange('09:00', '18:00')).toBeNull();
    });

    it('同一時間はエラーを返す', () => {
        expect(validateTimeRange('09:00', '09:00')).toContain('同じ');
    });

    it('不正な時間形式はエラーを返す', () => {
        expect(validateTimeRange('abc', '18:00')).not.toBeNull();
    });
});

describe('validation - validateTargetHours', () => {
    it('null/undefined は OK（オプショナル）', () => {
        expect(validateTargetHours(null)).toBeNull();
        expect(validateTargetHours(undefined)).toBeNull();
    });

    it('正常な値は null を返す', () => {
        expect(validateTargetHours(160)).toBeNull();
        expect(validateTargetHours(0)).toBeNull();
    });

    it('負の値はエラー', () => {
        expect(validateTargetHours(-1)).toContain('0以上');
    });

    it('999 より大きい値はエラー', () => {
        expect(validateTargetHours(1000)).toContain('999以下');
    });
});

describe('validation - validateWeeklyHoursTarget', () => {
    it('null/undefined は OK', () => {
        expect(validateWeeklyHoursTarget(null)).toBeNull();
    });

    it('168 以下は OK', () => {
        expect(validateWeeklyHoursTarget(40)).toBeNull();
    });

    it('169 はエラー', () => {
        expect(validateWeeklyHoursTarget(169)).toContain('168以下');
    });
});

describe('validation - validateRole', () => {
    it('正常な値は null を返す', () => {
        expect(validateRole('正社員')).toBeNull();
    });

    it('空文字はエラー', () => {
        expect(validateRole('')).toContain('入力してください');
    });
});

describe('validation - validateYearMonth', () => {
    it('正常なフォーマットは null を返す', () => {
        expect(validateYearMonth('2025-06')).toBeNull();
    });

    it('null はエラー', () => {
        expect(validateYearMonth(null)).toContain('必須');
    });

    it('不正な月はエラー', () => {
        expect(validateYearMonth('2025-13')).toContain('月が不正');
    });

    it('不正な年はエラー', () => {
        expect(validateYearMonth('1999-06')).toContain('年が不正');
    });

    it('不正なフォーマットはエラー', () => {
        expect(validateYearMonth('2025/06')).toContain('YYYY-MM');
    });
});

describe('validation - validateDate', () => {
    it('正常な日付は null を返す', () => {
        expect(validateDate('2025-06-15')).toBeNull();
    });

    it('null はエラー', () => {
        expect(validateDate(null)).toContain('必須');
    });

    it('不正な日はエラー', () => {
        expect(validateDate('2025-06-32')).toContain('日が不正');
    });
});

describe('validation - validateDayOfWeek', () => {
    it('0〜8 は OK', () => {
        for (let i = 0; i <= 8; i++) {
            expect(validateDayOfWeek(i)).toBeNull();
        }
    });

    it('範囲外はエラー', () => {
        expect(validateDayOfWeek(-1)).not.toBeNull();
        expect(validateDayOfWeek(9)).not.toBeNull();
    });
});

describe('validation - validateMinStaffCount', () => {
    it('1以上の整数は OK', () => {
        expect(validateMinStaffCount(1)).toBeNull();
        expect(validateMinStaffCount(10)).toBeNull();
    });

    it('0 はエラー', () => {
        expect(validateMinStaffCount(0)).toContain('1以上');
    });
});

describe('validation - validateMaxStaffCount', () => {
    it('null は OK（オプショナル）', () => {
        expect(validateMaxStaffCount(null, 1)).toBeNull();
    });

    it('minCount 以上は OK', () => {
        expect(validateMaxStaffCount(5, 3)).toBeNull();
        expect(validateMaxStaffCount(3, 3)).toBeNull();
    });

    it('minCount 未満はエラー', () => {
        expect(validateMaxStaffCount(2, 3)).toContain('最小スタッフ数以上');
    });
});

describe('validation - safeJsonParse', () => {
    it('正常な JSON をパースできる', () => {
        expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
        expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it('null/undefined はフォールバックを返す', () => {
        expect(safeJsonParse(null, 'default')).toBe('default');
        expect(safeJsonParse(undefined, [])).toEqual([]);
    });

    it('不正な JSON はフォールバックを返す', () => {
        expect(safeJsonParse('not-json', 'fallback')).toBe('fallback');
    });
});
